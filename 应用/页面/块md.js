(function(根) {
  const 层of = (b) => Math.max(0, Math.min(6, +(b && b.层) || 0));
  const 列表类 = new Set(["ul", "ol", "todo"]);
  const 默认 = {
    图址: (id) => "/api/prod/todo/img?id=" + id,
    文件址: (id) => "/api/todo/file?id=" + id,
    认图: (u) => {
      const m = /(?:^|\/)api\/(?:prod\/)?todo\/img\?(?:[^#]*&)?id=(\d+)/.exec(u);
      return m ? +m[1] : null;
    },
    认文件: (u) => {
      const m = /(?:^|\/)api\/(?:prod\/)?todo\/file\?(?:[^#]*&)?id=(\d+)/.exec(u);
      return m ? +m[1] : null;
    }
  };
  const 选项 = (选) => Object.assign({}, 默认, 选 || {});
  const 正 = {
    标题: /^(#{1,6})(?:[ \t]+(.*)|[ \t]*$)/,
    围栏: /^(`{3,}|~{3,})(.*)$/,
    分隔线: /^(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/,
    勾选: /^(?:[-+*]|\d{1,9}[.)])[ \t]+\[([ xX])\](?:[ \t]+(.*)|[ \t]*$)/,
    无序: /^[-+*](?:[ \t]+(.*)|[ \t]*$)/,
    有序: /^\d{1,9}[.)](?:[ \t]+(.*)|[ \t]*$)/,
    引用: /^>/,
    折叠: /^<details(\s+open)?\s*>/i,
    段开: /^<!--\s*段\s+(\S+)(\s+收起)?\s*-->\s*$/,
    段关: /^<!--\s*\/段\s*-->\s*$/,
    占位: /^<!--\s*占位\s*#(\d+)[\s\S]*?-->\s*$/,
    无表头: /^<!--\s*表格无表头\s*-->\s*$/,
    空行记号: /^<br\s*\/?>$/i,
    表分隔: /^(?=[^|]*\|)\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/,
    图行: /^!\[((?:[^\]\\]|\\.)*)\]\((\S+?)(?:\s+"([^"]*)")?\)\s*$/,
    文件行: /^\[((?:[^\]\\]|\\.)*)\]\((\S+?)(?:\s+"[^"]*")?\)\s*$/
  };
  const 图块 = (id, 注) => {
    const b = { type: "img", 附件id: id }, w = /(?:^|\s)w=(\d+)/.exec(注 || ""), al = /(?:^|\s)al=(left|center|right)/.exec(注 || "");
    if (w)
      b.w = +w[1];
    if (al)
      b.al = al[1];
    return b;
  };
  const 是附件行 = (s, 选) => {
    let m = 正.图行.exec(s);
    if (m && 选.认图(m[2]) != null)
      return true;
    m = 正.文件行.exec(s);
    return !!(m && 选.认文件(m[2]) != null);
  };
  function 转行首(s, 选) {
    const m = /^[ \t]+/.exec(s);
    if (m) {
      const 余 = s.slice(m[0].length);
      return m[0].replace(/ /g, "&#32;").replace(/\t/g, "&#9;") + (/^(\\|&#(32|9);)/.test(余) ? "\\" : "") + 余;
    }
    if (/^\d{1,9}\\*[.)](\s|$)/.test(s))
      return s.replace(/^(\d{1,9})/, "$1\\");
    if (/^(#{1,6}(\s|$)|>|[-+*](\s|$)|`{3}|~{3}|<|\||\\|=+\s*$|&#(32|9);|\[[ xX]\](\s|$))/.test(s) || 正.分隔线.test(s) || 正.表分隔.test(s) || 是附件行(s, 选))
      return "\\" + s;
    return s;
  }
  const 藏标 = (s, 名) => s.replace(new RegExp("&((?:amp;)*lt;" + 名 + ")", "gi"), "&amp;$1").replace(new RegExp("<(" + 名 + ")", "gi"), "&lt;$1");
  const 解标 = (s, 名) => s.replace(new RegExp("&(amp;)?((?:amp;)*)lt;(" + 名 + ")", "gi"), (m, a, 多, t) => a ? "&" + 多 + "lt;" + t : "<" + t);
  const 单行 = (s, 选) => 转行首(藏标(String(s || ""), "br").split(`
`).join("<br>"), 选);
  const 题行 = (s, 选) => {
    const t = 藏标(String(s || ""), "br").split(`
`).join("<br>");
    return /^([ \t]|\\|&#(32|9);|\d{1,9}\\+[.)](\s|$))/.test(t) ? 转行首(t, 选) : t;
  };
  const 列项 = (前, s, 选) => {
    const 内 = 单行(s, 选);
    return 前 + (正.分隔线.test((前 + 内).trim()) ? "\\" + 内 : 内);
  };
  const 表格 = (s) => 藏标(String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/\|/g, "\\|"), "br").replace(/\n/g, "<br>");
  function 占位行(b, i) {
    const t = b.type || "text";
    const 说 = t === "date" ? `日期块 ${[b.日期 || "没填日期", b.时间].filter(Boolean).join(" ")}` : t === "img" ? "还没存进库的图片" : t === "file" ? `还没存进库的文件 ${String(b.暂文 && b.暂文.原名 || "").replace(/-->/g, "")}`.trim() : `${t} 块`;
    return `<!-- 占位 #${i} ${说},回块编辑里改 -->`;
  }
  function 一块(b, i, 序, 选) {
    const t = b.type || "text", 缩 = "  ".repeat(层of(b)), 文 = String(b.text || "");
    const 行们 = 文 === "" ? [] : 文.split(`
`);
    if (t === "h")
      return 缩 + "#".repeat([1, 2, 3].includes(+b.级) ? +b.级 : 2) + " " + 题行(文, 选);
    if (t === "todo")
      return 缩 + 列项(b.勾 ? "- [x] " : "- [ ] ", 文, 选);
    if (t === "ul")
      return 缩 + 列项("- ", 文, 选);
    if (t === "ol")
      return 缩 + 列项(序 + ". ", 文, 选);
    if (t === "hr")
      return 缩 + "---";
    if (t === "quote")
      return (行们.length ? 行们 : [""]).map((l) => 缩 + (l === "" ? ">" : "> " + l)).join(`
`);
    if (t === "code") {
      const lang = String(b.lang || "");
      const 符 = lang.includes("`") ? "~" : "`";
      let 长 = 3;
      行们.forEach((l) => {
        const m = new RegExp("^\\s*(\\" + 符 + "+)").exec(l);
        if (m)
          长 = Math.max(长, m[1].length + 1);
      });
      const 栏 = 符.repeat(长);
      return [缩 + 栏 + lang, ...行们.map((l) => l ? 缩 + l : ""), 缩 + 栏].join(`
`);
    }
    if (t === "fold") {
      const 题 = 藏标(String(b.标题 || "").replace(/\n/g, " "), "\\/summary");
      return [
        缩 + `<details${b.展开 ? " open" : ""}><summary>${题}</summary>`,
        "",
        ...行们.map((l) => l ? 缩 + l.replace(/^(\s*)(\\*<\/?details)/i, "$1\\$2") : ""),
        "",
        缩 + "</details>"
      ].join(`
`);
    }
    if (t === "table") {
      const 行 = Array.isArray(b.行) ? b.行 : [];
      if (!行.length || !行.every((r) => Array.isArray(r) && r.length))
        return 缩 + 占位行(b, i);
      const 画行 = (r) => 缩 + "|" + r.map((c) => " " + 表格(c) + " |").join("");
      return [
        ...b.表头 ? [] : [缩 + "<!-- 表格无表头 -->"],
        画行(行[0]),
        缩 + "|" + 行[0].map(() => " --- |").join(""),
        ...行.slice(1).map(画行)
      ].join(`
`);
    }
    if (t === "img" && b.附件id != null && !b.暂 && !b.待抓) {
      const 名 = String(选.图名 && 选.图名(b.附件id) || "图").replace(/[[\]\\]/g, "");
      const 注 = [b.w ? "w=" + b.w : "", b.al ? "al=" + b.al : ""].filter(Boolean).join(" ");
      return 缩 + `![${名}](${选.图址(b.附件id)}${注 ? ` "${注}"` : ""})`;
    }
    if (t === "file" && b.附件id != null && !b.暂文) {
      const 名 = String(选.文件名 && 选.文件名(b.附件id) || "附件").replace(/[[\]\\]/g, (m) => "\\" + m);
      return 缩 + `[${名}](${选.文件址(b.附件id)})`;
    }
    if (t === "text")
      return 行们.length ? 行们.map((l) => 缩 + (l === "" ? "<br>" : 转行首(l, 选))).join(`
`) : 缩 + "<br>";
    return 缩 + 占位行(b, i);
  }
  function 拆空行(b) {
    const L = String(b.text || "").split(`
`), 出 = [];
    const 空 = () => {
      const e = { type: "text", text: "", 空: true };
      if (b.组) {
        e.组 = b.组;
        if (b.组收起)
          e.组收起 = true;
      }
      出.push(e);
    };
    if (L.every((l) => l === "")) {
      L.forEach(空);
      return 出;
    }
    let k = 0, z = L.length;
    while (L[k] === "") {
      空();
      k++;
    }
    while (L[z - 1] === "")
      z--;
    let 段 = [];
    for (let j = k;j < z; j++) {
      if (L[j] !== "") {
        段.push(L[j]);
        continue;
      }
      出.push(Object.assign({}, b, { text: 段.join(`
`) }));
      段 = [];
      for (j++;L[j] === ""; j++)
        空();
      j--;
    }
    出.push(Object.assign({}, b, { text: 段.join(`
`) }));
    for (let j = z;j < L.length; j++)
      空();
    return 出;
  }
  function 块转MD(bs, 选) {
    选 = 选项(选);
    const 件 = [];
    let 序 = 0, 当组 = "";
    (bs || []).forEach((b, i) => {
      const t = b.type || "text";
      序 = t === "ol" ? 序 + 1 : 0;
      const 组 = String(b.组 || "").trim().replace(/\s+/g, "_");
      const 组键 = 组 ? 组 + (b.组收起 ? " 收起" : "") : "";
      if (组键 !== 当组) {
        if (当组)
          件.push({ 文: "<!-- /段 -->", 类: "关" });
        if (组键)
          件.push({ 文: `<!-- 段 ${组键} -->`, 类: "开" });
        当组 = 组键;
      }
      if (t === "text")
        拆空行(b).forEach((x) => 件.push(x.空 ? { 文: "", 类: "空" } : { 文: 一块(x, i, 序, 选), 类: "块" }));
      else
        件.push({ 文: 一块(b, i, 序, 选), 类: 列表类.has(t) ? "列" : "块" });
    });
    if (当组)
      件.push({ 文: "<!-- /段 -->", 类: "关" });
    let 出 = "", 上 = null, 空数 = 0;
    件.forEach((x) => {
      if (x.类 === "空") {
        空数++;
        return;
      }
      出 += `
`.repeat((上 ? 本该换行(上.类, x.类) : 0) + 空数) + x.文;
      上 = x;
      空数 = 0;
    });
    return 出 + `
`.repeat((上 ? 1 : 0) + 空数);
  }
  const 本该换行 = (上类, 类) => 上类 === "开" || 类 === "关" || 上类 === "列" && 类 === "列" ? 1 : 2;
  function 解行首(s) {
    const m = /^(?:&#32;|&#9;)+/.exec(s);
    if (m) {
      const 余 = s.slice(m[0].length);
      return m[0].replace(/&#32;/g, " ").replace(/&#9;/g, "\t") + (/^\\(\\|&#(32|9);)/.test(余) ? 余.slice(1) : 余);
    }
    if (/^\\[!-/:-@[-`{-~]/.test(s))
      return s.slice(1);
    return s.replace(/^(\d{1,9})\\(\\*[.)])(?=\s|$)/, "$1$2");
  }
  const 解单行 = (s) => 解标(解行首(s || "").split(/<br\s*\/?>/i).join(`
`), "br");
  const 量缩 = (l) => {
    let n = 0, k = 0;
    for (;k < l.length; k++) {
      if (l[k] === " ")
        n++;
      else if (l[k] === "\t")
        n += 4;
      else
        break;
    }
    return { n, k };
  };
  const 去缩 = (l, n) => {
    let k = 0;
    while (k < l.length && k < n && l[k] === " ")
      k++;
    return l.slice(k);
  };
  function 拆表行(s) {
    let t = s.trim();
    if (t.startsWith("|"))
      t = t.slice(1);
    if (t.endsWith("|") && !/(^|[^\\])(\\\\)*\\\|$/.test(t))
      t = t.slice(0, -1);
    const 格 = [];
    let 当 = "";
    for (let k = 0;k < t.length; k++) {
      if (t[k] === "\\" && (t[k + 1] === "|" || t[k + 1] === "\\")) {
        当 += t[k + 1];
        k++;
        continue;
      }
      if (t[k] === "|") {
        格.push(当);
        当 = "";
        continue;
      }
      当 += t[k];
    }
    格.push(当);
    return 格.map((c) => 解标(c.replace(/^ /, "").replace(/ $/, "").split(/<br\s*\/?>/i).join(`
`), "br"));
  }
  const 隔 = "\x00隔";
  function MD转块(md, 选) {
    选 = 选项(选);
    const 原 = 选.原块 || [], 空行成块 = 选.空行成块 !== false;
    const 行 = String(md == null ? "" : md).replace(/\r\n?/g, `
`).split(`
`);
    if (行[行.length - 1] === "")
      行.pop();
    const 出 = [], 报 = { 占位: 0, 失效占位: 0, 外图: 0, 外文件: 0, 还原: [] };
    let 组 = "", 收 = false, 无表头 = false;
    const 号 = 选.记行 ? 行.map((_, k) => k) : null;
    let 当起 = 0, 待封 = 0;
    const 封 = () => {
      if (!号)
        return;
      let e = i - 1;
      while (e >= 0 && 号[e] < 0)
        e--;
      for (;待封 < 出.length; 待封++)
        if (出[待封].原行 && 出[待封].原行[1] < 0)
          出[待封].原行[1] = 号[e];
    };
    const 待层 = [];
    const 推 = (b, 缩n, 空) => {
      const lv = Math.min(6, Math.floor(缩n / 2));
      if (lv)
        b.层 = lv;
      else
        delete b.层;
      delete b.组;
      delete b.组收起;
      if (组) {
        b.组 = 组;
        if (收)
          b.组收起 = true;
      }
      if (空)
        待层.push(b);
      else {
        if (lv)
          待层.forEach((e) => {
            e.层 = lv;
          });
        待层.length = 0;
      }
      if (号 && !空)
        b.原行 = [号[当起], -1];
      出.push(b);
    };
    const 起头 = (s, 下) => 正.段开.test(s) || 正.段关.test(s) || 正.占位.test(s) || 正.无表头.test(s) || 正.围栏.test(s) || 正.标题.test(s) || 正.分隔线.test(s) || 正.勾选.test(s) || 正.无序.test(s) || 正.有序.test(s) || 正.引用.test(s) || 正.折叠.test(s) || 是附件行(s, 选) || s.includes("|") && 下 != null && 正.表分隔.test(下.trim());
    let 上类 = "", 空数 = 0;
    const 补空 = (类) => {
      const 多 = 空数 - (上类 ? 本该换行(上类, 类) - 1 : 0);
      if (空行成块)
        for (let k = 0;k < 多; k++)
          推({ type: "text", text: "" }, 0, true);
      上类 = 类;
      空数 = 0;
    };
    let i = 0;
    while (i < 行.length) {
      封();
      当起 = i;
      const l = 行[i];
      if (l === 隔) {
        i++;
        continue;
      }
      if (/^\s*$/.test(l)) {
        空数++;
        i++;
        continue;
      }
      const { n: 缩n, k: 缩k } = 量缩(l), s = l.slice(缩k), 下 = 行[i + 1];
      let m;
      if (m = 正.段开.exec(s)) {
        补空("开");
        组 = m[1];
        收 = !!m[2];
        i++;
        continue;
      }
      if (正.段关.test(s)) {
        补空("关");
        组 = "";
        收 = false;
        i++;
        continue;
      }
      if (正.无表头.test(s)) {
        补空("块");
        上类 = "开";
        无表头 = true;
        i++;
        continue;
      }
      补空(正.勾选.test(s) || 正.无序.test(s) || 正.有序.test(s) ? "列" : "块");
      const 这次无表头 = 无表头;
      无表头 = false;
      if (m = 正.占位.exec(s)) {
        const n = +m[1];
        if (原[n]) {
          const nb = Object.assign({}, 原[n]);
          推(nb, 缩n);
          报.占位++;
          报.还原.push([n, nb]);
        } else {
          推({ type: "text", text: s }, 缩n);
          报.失效占位++;
        }
        i++;
        continue;
      }
      if ((m = 正.围栏.exec(s)) && !(m[1][0] === "`" && m[2].includes("`"))) {
        const 符 = m[1][0], 长 = m[1].length, 体 = [];
        i++;
        while (i < 行.length) {
          const c = 行[i].trim();
          if (c.length >= 长 && new RegExp("^\\" + 符 + "{" + 长 + ",}\\s*$").test(c)) {
            i++;
            break;
          }
          体.push(行[i] === 隔 ? "" : 去缩(行[i], 缩n));
          i++;
        }
        const b = { type: "code", text: 体.join(`
`) };
        const lang = m[2].trim().slice(0, 20);
        if (lang)
          b.lang = lang;
        推(b, 缩n);
        continue;
      }
      if (m = 正.标题.exec(s)) {
        推({ type: "h", text: 解单行(m[2]), 级: Math.min(3, m[1].length) }, 缩n);
        i++;
        continue;
      }
      if (正.分隔线.test(s)) {
        推({ type: "hr" }, 缩n);
        i++;
        continue;
      }
      if (m = 正.勾选.exec(s)) {
        推({ type: "todo", text: 解单行(m[2]), 勾: m[1] !== " " }, 缩n);
        i++;
        continue;
      }
      if (m = 正.无序.exec(s)) {
        推({ type: "ul", text: 解单行(m[1]) }, 缩n);
        i++;
        continue;
      }
      if (m = 正.有序.exec(s)) {
        推({ type: "ol", text: 解单行(m[1]) }, 缩n);
        i++;
        continue;
      }
      if (正.引用.test(s)) {
        const 体 = [];
        while (i < 行.length && /^\s*>/.test(行[i])) {
          体.push(行[i].replace(/^\s*> ?/, ""));
          i++;
        }
        推({ type: "quote", text: 体.join(`
`) }, 缩n);
        continue;
      }
      if (m = 正.折叠.exec(s)) {
        const b = { type: "fold", 标题: "", text: "", 展开: !!m[1] };
        let 余 = s.slice(m[0].length);
        i++;
        if (!/<summary/i.test(余) && i < 行.length && /^\s*<summary/i.test(行[i])) {
          余 = 行[i].trim();
          i++;
        }
        const 题 = /<summary[^>]*>([\s\S]*?)(?:<\/summary>|$)/i.exec(余);
        if (题)
          b.标题 = 解标(题[1], "\\/summary");
        const 体 = [];
        let 关上 = /<\/details>\s*$/i.test(余);
        if (关上) {
          const 尾 = 余.replace(/<\/details>\s*$/i, "").replace(/^\s*<summary[^>]*>[\s\S]*?<\/summary>/i, "").trim();
          if (尾)
            体.push(尾);
        }
        let 深 = 0, 嵌起 = -1;
        while (!关上 && i < 行.length) {
          const c = 行[i].trim();
          if (/^<\/details>\s*$/i.test(c)) {
            if (!深) {
              i++;
              关上 = true;
              break;
            }
            深--;
          } else if (正.折叠.test(c)) {
            if (嵌起 < 0)
              嵌起 = i;
            if (!/<\/details>\s*$/i.test(c))
              深++;
          }
          if (嵌起 < 0)
            体.push(去缩(行[i], 缩n).replace(/^(\s*)\\(\\*<\/?details)/i, "$1$2"));
          i++;
        }
        if (体.length && 体[0] === "")
          体.shift();
        if (体.length && 体[体.length - 1] === "")
          体.pop();
        b.text = 体.join(`
`);
        推(b, 缩n);
        if (嵌起 >= 0) {
          const 子 = 行.slice(嵌起, 关上 ? i - 1 : i).map((l) => /^\s*$/.test(l) ? "" : " ".repeat(缩n + 2) + 去缩(l, 缩n));
          子.push(隔);
          if (号)
            号.splice(i, 0, ...号.slice(嵌起, 关上 ? i - 1 : i), -1);
          行.splice(i, 0, ...子);
        }
        continue;
      }
      if (s.includes("|") && 下 != null && 正.表分隔.test(下.trim())) {
        const 行们 = [拆表行(s)];
        i += 2;
        while (i < 行.length && 行[i].trim() && 行[i].includes("|")) {
          行们.push(拆表行(行[i]));
          i++;
        }
        推({ type: "table", 表头: !这次无表头, 行: 行们 }, 缩n);
        continue;
      }
      if ((m = 正.图行.exec(s)) && 选.认图(m[2]) != null) {
        const id = 选.认图(m[2]);
        if (选.图在 && !选.图在(id)) {
          推({ type: "text", text: s }, 缩n);
          报.外图++;
          i++;
          continue;
        }
        推(图块(id, m[3]), 缩n);
        i++;
        continue;
      }
      if ((m = 正.文件行.exec(s)) && 选.认文件(m[2]) != null) {
        const id = 选.认文件(m[2]);
        if (选.文件在 && !选.文件在(id)) {
          推({ type: "text", text: s }, 缩n);
          报.外文件++;
          i++;
          continue;
        }
        推({ type: "file", 附件id: id }, 缩n);
        i++;
        continue;
      }
      const 体 = [];
      for (;; ) {
        const c = 去缩(行[i], 体.length ? 缩n : 缩k);
        体.push(正.空行记号.test(c.trim()) ? "" : 解行首(体.length ? c : s));
        i++;
        if (i >= 行.length || 行[i] === 隔 || /^\s*$/.test(行[i]))
          break;
        const 下s = 行[i].slice(量缩(行[i]).k);
        if (起头(下s, 行[i + 1]))
          break;
      }
      推({ type: "text", text: 体.join(`
`) }, 缩n);
    }
    封();
    if (空行成块)
      for (let k = 0;k < 空数; k++)
        推({ type: "text", text: "" }, 0, true);
    let 上 = -1;
    出.forEach((b) => {
      const lv = Math.max(0, Math.min(层of(b), 上 + 1));
      if (lv)
        b.层 = lv;
      else
        delete b.层;
      上 = lv;
    });
    if (!出.length)
      出.push({ type: "text", text: "" });
    return { 块: 出, 报 };
  }
  const 尾空 = new Set(["h", "table", "quote", "code", "fold", "hr"]);
  function 块转原文(bs, 选) {
    选 = 选项(选);
    bs = (bs || []).slice();
    const 行 = [], 属 = [], 序们 = [], 占 = [];
    let 序 = 0;
    bs.forEach((b, i) => {
      const t = b.type || "text";
      序 = t === "ol" ? 序 + 1 : 0;
      序们.push(序);
      let 写;
      if (t === "text")
        写 = String(b.text || "").split(`
`).map((l) => "  ".repeat(层of(b)) + l);
      else {
        const w = 一块(b, 占.length, 序, 选);
        if (!w.includes(`
`) && 正.占位.test(w.trim()))
          占.push(b);
        写 = w.split(`
`);
      }
      if (尾空.has(t))
        写.push("");
      写.forEach((l) => {
        行.push(l);
        属.push(i);
      });
    });
    if (!行.length) {
      行.push("");
      属.push(-1);
    }
    return { md: 行.join(`
`), 行, 属, 序: 序们, 占, 块: bs };
  }
  function 对行(旧, 新, 上限) {
    const 对 = new Int32Array(新.length).fill(-1);
    let a = 0, z1 = 旧.length, z2 = 新.length;
    while (a < z1 && a < z2 && 旧[a] === 新[a]) {
      对[a] = a;
      a++;
    }
    while (z1 > a && z2 > a && 旧[z1 - 1] === 新[z2 - 1]) {
      z1--;
      z2--;
      对[z2] = z1;
    }
    const n = z1 - a, m = z2 - a;
    if (!n || !m)
      return 对;
    const 号 = new Map, 编 = (s) => {
      let v = 号.get(s);
      if (v === undefined) {
        v = 号.size;
        号.set(s, v);
      }
      return v;
    };
    const A = new Int32Array(n), B = new Int32Array(m);
    for (let k = 0;k < n; k++)
      A[k] = 编(旧[a + k]);
    for (let k = 0;k < m; k++)
      B[k] = 编(新[a + k]);
    const 顶 = Math.min(n + m, 上限), 偏 = 顶 + 1, v = new Int32Array(2 * 顶 + 3), 迹 = [];
    let 到 = -1;
    for (let d = 0;d <= 顶 && 到 < 0; d++) {
      迹.push(v.slice(偏 - d - 1, 偏 + d + 2));
      for (let k = -d;k <= d; k += 2) {
        let x = k === -d || k !== d && v[偏 + k - 1] < v[偏 + k + 1] ? v[偏 + k + 1] : v[偏 + k - 1] + 1, y = x - k;
        while (x < n && y < m && A[x] === B[y]) {
          x++;
          y++;
        }
        v[偏 + k] = x;
        if (x >= n && y >= m) {
          到 = d;
          break;
        }
      }
    }
    if (到 < 0)
      return 对;
    let x = n, y = m;
    for (let d = 到;d >= 0; d--) {
      const w = 迹[d], g = (k) => w[k + d + 1], k = x - y;
      const pk = k === -d || k !== d && g(k - 1) < g(k + 1) ? k + 1 : k - 1, px = g(pk), py = px - pk;
      while (x > px && y > py) {
        x--;
        y--;
        对[a + y] = a + x;
      }
      x = px;
      y = py;
    }
    return 对;
  }
  function 一行回块(l, 选, 占, 用过, 报) {
    const 缩 = /^ */.exec(l)[0].length, lv = Math.min(6, 缩 >> 1), s = l.slice(缩);
    const 字 = () => {
      const b = { type: "text", text: l.slice(lv * 2) };
      if (lv)
        b.层 = lv;
      return b;
    };
    const 定层 = (b) => {
      if (lv)
        b.层 = lv;
      return b;
    };
    let m;
    if (m = 正.占位.exec(s)) {
      const n = +m[1], o = 占[n];
      if (!o || 用过.has(o)) {
        报.失效占位++;
        return 字();
      }
      用过.add(o);
      const nb = Object.assign({}, o);
      delete nb.组;
      delete nb.组收起;
      delete nb.层;
      报.占位++;
      报.还原.push([n, nb]);
      return 定层(nb);
    }
    if ((m = 正.图行.exec(s)) && 选.认图(m[2]) != null) {
      const id = 选.认图(m[2]);
      if (选.图在 && !选.图在(id)) {
        报.外图++;
        return 字();
      }
      return 定层(图块(id, m[3]));
    }
    if ((m = 正.文件行.exec(s)) && 选.认文件(m[2]) != null) {
      const id = 选.认文件(m[2]);
      if (选.文件在 && !选.文件在(id)) {
        报.外文件++;
        return 字();
      }
      return 定层({ type: "file", 附件id: id });
    }
    return 字();
  }
  function 原文回块(md, 开时, 选) {
    选 = 选项(选);
    const 原 = 开时.块 || [], 旧 = 开时.行 || [""], 属 = 开时.属 || [], 旧序 = 开时.序 || [], 占 = 开时.占 || [];
    const 新 = String(md == null ? "" : md).replace(/\r\n?/g, `
`).split(`
`);
    const 对 = 对行(旧, 新, 1500);
    const 起 = new Map, 止 = new Map;
    属.forEach((b, k) => {
      if (b < 0)
        return;
      if (!起.has(b))
        起.set(b, k);
      止.set(b, k);
    });
    const 旧到新 = new Int32Array(旧.length).fill(-1);
    对.forEach((o, j) => {
      if (o >= 0)
        旧到新[o] = j;
    });
    const 留 = new Set;
    起.forEach((a, b) => {
      const z = 止.get(b);
      let ok = 旧到新[a] >= 0;
      for (let k = a + 1;k <= z && ok; k++)
        ok = 旧到新[k] === 旧到新[a] + k - a;
      if (ok)
        留.add(b);
    });
    const 文块 = (b) => b >= 0 && !留.has(b) && ["text", "code"].includes(原[b].type || "text");
    const 段们 = [];
    {
      let pi = -1, pj = -1;
      for (let j = 0;j <= 新.length; j++) {
        const o = j < 新.length ? 对[j] : 旧.length;
        if (o < 0)
          continue;
        if (o - pi > 1 || j - pj > 1) {
          const 主 = o - pi > 1 ? 属.slice(pi + 1, o).every((b) => b === 属[pi + 1]) ? 属[pi + 1] : -1 : pi >= 0 && o < 旧.length && 属[pi] === 属[o] ? 属[o] : -1;
          段们.push({ i1: pi + 1, i2: o - 1, j1: pj + 1, j2: j - 1, 主: 文块(主) ? 主 : -1 });
        }
        pi = o;
        pj = j;
      }
    }
    const 重 = new Map;
    起.forEach((a, b) => {
      if (!文块(b))
        return;
      const z = 止.get(b);
      if (段们.some((d) => d.主 !== b && (d.i1 <= d.i2 ? d.i1 <= z && d.i2 >= a : d.i1 > a && d.i1 <= z)))
        return;
      if (原[b].type === "code") {
        const 缩 = "  ".repeat(层of(原[b])), jo = 旧到新[a], jc = 旧到新[z - 1];
        if (jo < 0 || jc <= jo || 旧到新[z] !== jc + 1)
          return;
        const 里 = 新.slice(jo + 1, jc);
        if (里.some((l) => l && !l.startsWith(缩)))
          return;
        const text = 里.map((l) => l.slice(缩.length)).join(`
`);
        if (一块(Object.assign({}, 原[b], { text }), 0, 0, 选) !== 新.slice(jo, jc + 1).join(`
`))
          return;
        重.set(b, { j1: jo, j2: jc + 1, text });
        return;
      }
      let j1 = 1 / 0, j2 = -1;
      for (let k = a;k <= z; k++)
        if (旧到新[k] >= 0) {
          j1 = Math.min(j1, 旧到新[k]);
          j2 = Math.max(j2, 旧到新[k]);
        }
      段们.forEach((d) => {
        if (d.主 === b && d.j1 <= d.j2) {
          j1 = Math.min(j1, d.j1);
          j2 = Math.max(j2, d.j2);
        }
      });
      const 缩 = "  ".repeat(层of(原[b])), 行们 = 新.slice(j1, j2 + 1);
      if (行们.some((l) => !l.startsWith(缩) || 正.占位.test(l.trim()) || 是附件行(l.trim(), 选)))
        return;
      重.set(b, { j1, j2, text: 行们.map((l) => l.slice(缩.length)).join(`
`) });
    });
    const 报 = { 占位: 0, 失效占位: 0, 外图: 0, 外文件: 0, 还原: [] }, 用过 = new Set([...留].map((b) => 原[b]));
    const 件 = [], 盖 = new Map;
    重.forEach(({ j1, j2 }, b) => {
      if (j2 >= j1)
        盖.set(j1, b);
    });
    for (let j = 0;j < 新.length; j++) {
      if (盖.has(j)) {
        const b = 盖.get(j), { j2, text } = 重.get(b);
        件.push({ b: Object.assign({}, 原[b], { text }), 重: true, j, n: j2 - j + 1, 来: b });
        j = j2;
        continue;
      }
      const o = 对[j], b = o >= 0 ? 属[o] : -1;
      if (o >= 0 && b < 0)
        continue;
      if (留.has(b)) {
        if (o === 起.get(b))
          件.push({ b: 原[b], 留: true, j, n: 止.get(b) - 起.get(b) + 1, 来: b });
        continue;
      }
      if (重.has(b))
        continue;
      件.push({ b: 一行回块(新[j], 选, 占, 用过, 报), 留: false, j, n: 1, 来: b });
    }
    const 出 = [];
    let 上 = -1, 序 = 0;
    const 收 = (x) => {
      const lv = 层of(x.b), 合 = Math.max(0, Math.min(lv, 上 + 1)), 是序 = (x.b.type || "text") === "ol";
      if ((x.留 || x.重) && (lv > 合 || x.留 && 是序 && 序 + 1 !== 旧序[x.来])) {
        用过.delete(x.b);
        for (let k = 0;k < x.n; k++)
          收({ b: 一行回块(新[x.j + k], 选, 占, 用过, 报), 留: false, j: x.j + k, n: 1, 来: x.来 });
        return;
      }
      if (lv > 合) {
        if ((x.b.type || "text") === "text")
          x.b.text = " ".repeat((lv - 合) * 2) + x.b.text;
        if (合)
          x.b.层 = 合;
        else
          delete x.b.层;
      }
      出.push(x);
      上 = 合;
      序 = 是序 ? 序 + 1 : 0;
    };
    件.forEach(收);
    const 锚 = (x) => x.留 ? x.b : x.来 >= 0 ? 原[x.来] : null, f = 出.findIndex(锚);
    出.forEach((x, k) => {
      if (x.留 || x.重)
        return;
      const 从 = 锚(x) || (f < 0 ? null : k < f ? 锚(出[f]) : 出[k - 1].b);
      if (从 && 从.组) {
        x.b.组 = 从.组;
        if (从.组收起)
          x.b.组收起 = true;
      }
    });
    const 块 = 出.map((x) => x.b);
    if (!块.length)
      块.push({ type: "text", text: "" });
    return { 块, 报 };
  }
  const 细标 = "\\/?(?:details|summary)";
  const 藏字 = (s) => 藏标(藏标(String(s == null ? "" : s), "br"), 细标);
  const HTML起 = /^(?:<(?:script|pre|style|textarea)(?:\s|>|$)|<!--|<\?|<![A-Za-z]|<!\[CDATA\[|<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>\s*$)/i;
  const 下划 = /^(?:=+|-+)[ \t]*$/;
  function 认行(s, 下) {
    let m;
    if ((m = 正.围栏.exec(s)) && !(m[1][0] === "`" && m[2].includes("`")))
      return "栏";
    if (正.标题.test(s))
      return "h";
    if (正.分隔线.test(s))
      return "hr";
    if (正.勾选.test(s) || 正.无序.test(s) || 正.有序.test(s))
      return "li";
    if (正.引用.test(s))
      return "quote";
    if (s.includes("|") && 下 != null && 正.表分隔.test(下.trim()))
      return "table";
    if (HTML起.test(s))
      return "html";
    if (下划.test(s) || 正.表分隔.test(s))
      return "alone";
    return "p";
  }
  const 标行 = (s, 选) => {
    const t = 转行首(s, 选);
    return t === s && /^(?:-+[ \t]*$|\[[^\]]*\]:)/.test(s) ? "\\" + s : t;
  };
  const 硬断 = (行们, 原样) => 行们.map((l, j) => l && 行们[j + 1] && !(原样 ? /( {2,}|\\)$/ : / {2,}$/).test(l) ? l + "  " : l);
  function 文段(s, 选) {
    const 出 = [];
    String(s == null ? "" : s).split(`
`).forEach((l) => {
      if (l.trim())
        出.push(标行(藏字(l), 选));
      else if (出.length && 出[出.length - 1] !== "")
        出.push("");
    });
    while (出.length && 出[出.length - 1] === "")
      出.pop();
    return 硬断(出, false);
  }
  const 标列 = (前, s, 选) => {
    const 内 = 标行(藏字(s).split(`
`).join("<br>"), 选);
    return 前 + (正.分隔线.test((前 + 内).trim()) ? "\\" + 内 : 内);
  };
  const 题 = (s, 选) => 题行(藏标(String(s == null ? "" : s), 细标), 选).replace(/(^|[ \t])(#+[ \t]*)$/, "$1\\$2");
  const 补站 = (u, 站) => {
    u = String(u == null ? "" : u);
    if (!站 || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(u))
      return u;
    return String(站).replace(/\/+$/, "") + (u.startsWith("/") ? "" : "/") + u;
  };
  const 址 = (u) => u.replace(/[()<>]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()).replace(/\s/g, (c) => encodeURIComponent(c));
  function 引行(行们) {
    const 内 = 行们.map((l) => l.replace(/^>[ \t]?/, ""));
    let 关 = null;
    const 平 = 内.map((c, j) => {
      const t = c.replace(/^[ \t]+/, ""), 缩 = c.length - t.length;
      if (关) {
        if (关.test(t.trim()))
          关 = null;
        return false;
      }
      const m = 缩 < 4 && 正.围栏.exec(t);
      if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
        关 = new RegExp("^\\" + m[1][0] + "{" + m[1].length + ",}\\s*$");
        return false;
      }
      return !!t && 缩 < 4 && 认行(t, j + 1 < 内.length ? 内[j + 1] : null) === "p";
    });
    return 行们.map((l, j) => 平[j] && 平[j + 1] && !/( {2,}|\\)$/.test(l) ? l + "  " : l);
  }
  function 一件(b, 选) {
    const t = b.type || "text", lv = 层of(b), 文 = String(b.text == null ? "" : b.text);
    const 件 = (类, 行, 另) => Object.assign({ 类, lv, 行 }, 另 || {});
    if (t === "h")
      return 件("h", [("#".repeat([1, 2, 3].includes(+b.级) ? +b.级 : 2) + " " + 题(文, 选)).replace(/[ \t]+$/, "")]);
    if (t === "ul" || t === "todo")
      return 件("li", [标列(t === "ul" ? "- " : b.勾 ? "- [x] " : "- [ ] ", 文, 选)], { 型: "b-", 号: null, 宽: 2, 空: t === "ul" && 文 === "" });
    if (t === "ol")
      return 件("li", null, { 型: "o.", 算号: true, 字: 文, 空: 文 === "" });
    if (t === "hr")
      return 件("hr", ["---"]);
    if (t === "quote") {
      const 段 = 文段(文, 选);
      return 件("quote", 段.length ? 段.map((l) => l === "" ? ">" : "> " + l) : [">"]);
    }
    if (t === "code") {
      const lang = String(b.lang || "").replace(/\s+/g, " ").trim(), 符 = lang.includes("`") ? "~" : "`";
      let 长 = 3;
      (文.match(符 === "`" ? /`+/g : /~+/g) || []).forEach((r) => {
        长 = Math.max(长, r.length + 1);
      });
      const 栏 = 符.repeat(长);
      return 件("码", [栏 + lang, ...文 === "" ? [] : 文.split(`
`), 栏]);
    }
    if (t === "fold") {
      const 题字 = String(b.标题 || "").replace(/\s*\n\s*/g, " ").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "折叠";
      const 正文 = 文段(文, 选);
      return 件("fold", [`<details${b.展开 ? " open" : ""}><summary>${题字}</summary>`, ...正文.length ? ["", ...正文] : []]);
    }
    if (t === "table") {
      const 行 = (Array.isArray(b.行) ? b.行 : []).filter((r) => Array.isArray(r)), n = Math.max(0, ...行.map((r) => r.length));
      if (!行.length || !n)
        return null;
      const 画 = (r) => "|" + Array.from({ length: n }, (_, j) => " " + 表格(藏标(String(r[j] == null ? "" : r[j]), 细标)) + " |").join("");
      const 分 = "|" + " --- |".repeat(n);
      return 件("table", b.表头 ? [画(行[0]), 分, ...行.slice(1).map(画)] : [画([]), 分, ...行.map(画)]);
    }
    if (t === "img") {
      const u = b.待抓 ? String(b.待抓) : b.附件id != null && !b.暂 ? 补站(选.图址(b.附件id), 选.站点) : "";
      return u ? 件("img", [`![](${址(u)})`]) : null;
    }
    if (t === "file") {
      if (b.附件id == null || b.暂文)
        return null;
      const 名 = String(选.文件名 && 选.文件名(b.附件id) || "附件").replace(/[[\]\\]/g, (m) => "\\" + m);
      return 件("file", [`[${名}](${址(补站(选.文件址(b.附件id), 选.站点))})`]);
    }
    if (t === "date") {
      const d = [b.日期, b.时间].filter(Boolean).join(" ");
      return d ? 件("date", [标行(d, 选)]) : null;
    }
    const 段 = 文段(文, 选);
    return 段.length ? 件("p", 段) : null;
  }
  function 拆件(bs, 选) {
    const 条 = [];
    bs.forEach((b, i) => {
      if ((b.type || "text") !== "text") {
        条.push({ 块: b });
        return;
      }
      const 缩 = "  ".repeat(层of(b));
      String(b.text == null ? "" : b.text).split(`
`).forEach((l) => 条.push({ 全: 缩 + l, 号: i }));
    });
    const 字 = (k) => 条[k] && !条[k].块 ? 条[k].全 : null, 件 = [];
    for (let k = 0;k < 条.length; k++) {
      if (条[k].块) {
        const u = 一件(条[k].块, 选);
        if (u)
          件.push(u);
        continue;
      }
      const l = 字(k);
      if (/^\s*$/.test(l)) {
        件.push({ 类: "空" });
        continue;
      }
      const { n, k: 起 } = 量缩(l), s = l.slice(起), lv = Math.min(6, n >> 1), 类 = 认行(s, 字(k + 1));
      if (类 === "栏") {
        const m = 正.围栏.exec(s), 符 = m[1][0], 长 = m[1].length, 关 = new RegExp("^\\" + 符 + "{" + 长 + ",}\\s*$"), 行们 = [s];
        let 合 = false;
        for (k++;字(k) != null; k++) {
          const c = 字(k).trim();
          if (c.length >= 长 && 关.test(c)) {
            行们.push(c);
            合 = true;
            break;
          }
          行们.push(去缩(字(k), n));
        }
        if (!合) {
          行们.push(符.repeat(长));
          k--;
        }
        件.push({ 类: "栏", lv, 行: 行们 });
      } else if (类 === "quote") {
        const 行们 = [];
        for (;字(k) != null && /^\s*>/.test(字(k)); k++)
          行们.push(字(k).replace(/^\s+/, ""));
        k--;
        件.push({ 类: "quote", lv, 行: 引行(行们) });
      } else if (类 === "table") {
        const 行们 = [s.trim(), 字(k + 1).trim()];
        for (k += 2;字(k) != null && 字(k).trim() && 字(k).includes("|"); k++)
          行们.push(字(k).trim());
        k--;
        件.push({ 类: "table", lv, 行: 行们 });
      } else if (类 === "p") {
        const 号 = 条[k].号, 行们 = [s];
        while (字(k + 1) != null && 条[k + 1].号 === 号 && /\S/.test(字(k + 1))) {
          const t = 字(k + 1).replace(/^\s+/, "");
          if (认行(t, 字(k + 2)) !== "p")
            break;
          行们.push(t);
          k++;
        }
        件.push({ 类: "p", lv, 行: 硬断(行们, true) });
      } else if (类 === "li") {
        const m = /^(?:([-+*])|(\d{1,9})([.)]))([ \t]*)/.exec(s), 空格 = m[4].replace(/\t/g, "    ").length, 空 = !s.slice(m[0].length).trim();
        件.push({ 类: "li", lv, 行: [s], 型: m[1] ? "b" + m[1] : "o" + m[3], 号: m[2] != null ? +m[2] : null, 宽: m[0].length - m[4].length + (空 || 空格 > 4 ? 1 : 空格), 空 });
      } else
        件.push({ 类, lv, 行: [s] });
    }
    return 件;
  }
  const 需空 = (A, B) => A.类 === "li" && B.类 === "li" ? B.lv > A.lv && B.新列 && (B.型[0] === "o" && B.号 !== 1 || B.空) : !(A.类 === "html" && B.类 === "html");
  function 排件(件, 选) {
    const 出 = [], 栈 = [], 列 = [];
    let 上 = null, 空待 = false, 前 = -1, 基 = null;
    const 推 = (行们, 容) => 行们.forEach((l) => 出.push(l === "" ? "" : " ".repeat(容) + l));
    const 收 = (e) => {
      if (!e.折)
        return;
      if (出[出.length - 1] !== "")
        出.push("");
      推(["</details>"], e.容);
      上 = { 类: "折尾", lv: e.lv };
    };
    件.forEach((u) => {
      if (u.类 === "空") {
        空待 = true;
        return;
      }
      基 = 基 === null ? u.lv : Math.min(基, u.lv);
      const L = Math.min(u.lv - 基, 前 + 1);
      while (栈.length && 栈[栈.length - 1].lv >= L)
        收(栈.pop());
      const 容 = 栈.length ? 栈[栈.length - 1].内 : 0, 这 = Object.assign({}, u, { lv: L });
      列.length = Math.min(列.length, L + 1);
      let 宽 = 0;
      if (u.类 === "li") {
        const 旧 = 列[L], 续 = !!旧 && 旧.型 === u.型;
        if (u.算号) {
          这.号 = 续 ? 旧.号 + 1 : 1;
          这.行 = [标列(这.号 + ". ", u.字, 选)];
          宽 = String(这.号).length + 2;
        } else
          宽 = u.宽;
        这.新列 = !续;
        列[L] = { 型: u.型, 号: 这.号 };
      } else
        列[L] = null;
      if (上 && (空待 || 需空(上, 这)))
        出.push("");
      推(这.行, 容);
      栈.push({ lv: L, 内: 容 + 宽, 折: u.类 === "fold", 容 });
      上 = 这;
      空待 = false;
      前 = L;
    });
    while (栈.length)
      收(栈.pop());
    return 出;
  }
  function 块转标准MD(bs, 选) {
    选 = 选项(选);
    const 段们 = [];
    let 当 = null;
    (bs || []).forEach((b) => {
      if (!b)
        return;
      const 组 = String(b.组 || "").trim().replace(/\s+/g, "_"), 键 = 组 ? 组 + (b.组收起 ? " 收起" : "") : "";
      if (!当 || 当.键 !== 键)
        段们.push(当 = { 键, 块们: [] });
      当.块们.push(b);
    });
    const 出 = [];
    段们.forEach((r) => {
      let 行 = 排件(拆件(r.块们, 选), 选);
      if (!行.length)
        return;
      if (r.键)
        行 = 行.map((l) => l === "" ? ">" : "> " + l);
      if (出.length)
        出.push("");
      出.push(...行);
    });
    return 出.length ? 出.join(`
`) + `
` : "";
  }
  const 出口 = { 块转MD, MD转块, 层of, 块转原文, 原文回块, 块转标准MD };
  if (typeof module === "object" && module.exports)
    module.exports = 出口;
  else
    根.块MD = 出口;
})(typeof window !== "undefined" ? window : globalThis);

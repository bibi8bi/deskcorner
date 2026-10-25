(function() {
  if (window.装表格)
    return;
  var 条件们 = [["含有", true], ["不含", true], ["等于", true], ["不等于", true], ["为空", false], ["不为空", false]];
  function 取存(键) {
    try {
      return JSON.parse(localStorage.getItem(键) || "null");
    } catch (e) {
      return null;
    }
  }
  function 写存(键, 值) {
    try {
      localStorage.setItem(键, JSON.stringify(值));
    } catch (e) {}
  }
  function 默认报(话) {
    if (window.console)
      console.log(话);
  }
  function 元(签, 类, 字) {
    var e = document.createElement(签);
    if (类)
      e.className = 类;
    if (字 != null)
      e.textContent = 字;
    return e;
  }
  function 抄走(文) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(文).then(function() {
        return true;
      }, function() {
        return 老法抄(文);
      });
    }
    return Promise.resolve(老法抄(文));
  }
  function 老法抄(文) {
    try {
      var t = document.createElement("textarea");
      t.value = 文;
      t.style.position = "fixed";
      t.style.top = "-999px";
      t.setAttribute("aria-hidden", "true");
      document.body.appendChild(t);
      t.select();
      var 成 = document.execCommand("copy");
      t.remove();
      return 成;
    } catch (e) {
      return false;
    }
  }
  function CSV格(s) {
    s = String(s == null ? "" : s);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function 今天() {
    var d = new Date;
    var 二 = function(n) {
      return (n < 10 ? "0" : "") + n;
    };
    return d.getFullYear() + "-" + 二(d.getMonth() + 1) + "-" + 二(d.getDate());
  }
  window.装表格 = function(选项) {
    var 表 = 选项 && 选项.表;
    if (!表)
      return null;
    var 头行 = 表.querySelector("thead tr"), 列组 = 表.querySelector("colgroup");
    if (!头行 || !列组)
      return null;
    表.classList.add("勾选表");
    var 可勾 = 选项.可勾 !== false, 批量们 = 选项.批量们 || [], 不可隐 = 选项.不可隐 || [];
    var 存根 = "AI表-" + (选项.存键 || "表");
    var 搜词 = "", 筛们 = [], 排序 = null, 隐列 = {}, 列序 = null, 冻结 = 0;
    var 选中 = 选项.选中集 || new Set, 位 = 选项.单位 || "条";
    var 报 = 选项.报 || 默认报;
    function 勾着(tr) {
      return 选中.has(行键(tr));
    }
    function 能勾(tr) {
      return 选项.可勾行 ? !!选项.可勾行(tr) : true;
    }
    function 通知() {
      if (选项.勾变)
        选项.勾变();
    }
    function 已选数() {
      return 选项.已选数 ? 选项.已选数() : 取选中().length;
    }
    var 勾选列宽 = 选项.勾选列宽 || 34;
    var 壳 = 元("div", "条换");
    var 条 = 元("div", "表条"), 批 = 元("div", "表条 批条"), 筛板 = 元("div", "表筛选板"), 效条 = 元("div", "筛条");
    效条.hidden = true;
    var 搜框 = document.createElement("input");
    搜框.className = "搜";
    搜框.type = "search";
    搜框.placeholder = "搜这张清单";
    搜框.setAttribute("aria-label", "搜这张清单");
    搜框.title = "在下面这张表里找:把每一行所有格子的字连起来找,找到的留下,别的先藏起来。清空就全回来。";
    var 筛钮 = 造钮("筛选", "按条件挑出要看的那几行。多条一起用,每条都得满足。");
    var 列钮 = 造钮("列", "哪几列显示、谁在前谁在后。改完只影响你这台电脑看到的样子,资料一个字节都不动。");
    var 冻钮 = 造钮("冻结", "把最左边一两列钉住,横着拉的时候它们不跟着跑。");
    var 视钮 = 造钮("视图", "把现在这套看法(搜的词、筛的条件、排序、列、冻结)存下来,下次一点就回来。只存在这台电脑的浏览器里。");
    var 导钮 = 造钮("导出 CSV", "把现在屏上这些行导成一个 CSV 文件,Excel 能直接打开。勾中了行就只导勾的那几份。");
    var 计数 = 元("span", "数说");
    function 造钮(字, 悬) {
      var b = 元("button", "mini", 字);
      b.type = "button";
      b.title = 悬;
      return b;
    }
    var 视包 = 元("span", "视图包"), 视单 = 元("div", "视图单");
    视单.hidden = true;
    视钮.classList.add("视图钮");
    视钮.setAttribute("aria-expanded", "false");
    视包.append(视钮, 视单);
    条.append(搜框, 筛钮, 列钮, 冻钮, 视包, 导钮);
    (选项.加钮们 || []).forEach(function(b) {
      条.appendChild(b);
    });
    壳.append(条, 批);
    var 框 = 选项.放在 || 表.closest(".表框") || 表;
    var 放置点 = 框.closest(".表框外") || 框;
    放置点.before(壳);
    壳.after(效条);
    var 表名行 = (框.closest(".表壳") || 框.parentElement || document).querySelector(".表名");
    if (表名行)
      表名行.append(计数);
    else {
      计数.style.marginLeft = "auto";
      条.append(计数);
    }
    var 遮幕 = 元("div", "弹窗遮幕"), 弹壳 = 元("div", "弹窗外壳 弹窗小窗");
    var 弹头 = 元("div", "弹窗标题栏"), 弹题 = 元("h2", "弹窗标题", "高级筛选");
    var 放大钮 = 元("button", "弹窗放大钮", "⤢");
    放大钮.type = "button";
    放大钮.title = "放大";
    放大钮.setAttribute("aria-label", "放大");
    var 弹关 = 元("button", "弹窗关闭钮", "✗");
    弹关.type = "button";
    弹关.title = "关掉这个窗";
    弹关.setAttribute("aria-label", "关掉这个窗");
    弹头.append(弹题, 放大钮, 弹关);
    var 弹窗正 = 元("div", "弹窗正文");
    弹窗正.appendChild(筛板);
    弹壳.append(弹头, 弹窗正);
    遮幕.appendChild(弹壳);
    遮幕.hidden = true;
    document.body.appendChild(遮幕);
    var 弹窗控 = null;
    if (window.UI弹窗三档)
      弹窗控 = window.UI弹窗三档({ 弹窗: 弹壳 });
    else
      放大钮.hidden = true;
    function 开筛窗() {
      遮幕.hidden = false;
      画筛选板();
      if (机柄 && !机柄.层.hidden && window.UI叠层)
        window.UI叠层.压(遮幕, { 名: "高级筛选", 关: 关筛窗, 钮位: ".弹窗标题栏", 关闭钮: 弹关 });
    }
    function 关筛窗() {
      遮幕.hidden = true;
      if (弹窗控)
        弹窗控.还原();
    }
    筛钮.addEventListener("click", 开筛窗);
    弹关.addEventListener("click", 关筛窗);
    遮幕.addEventListener("click", function(e) {
      if (e.target === 遮幕)
        关筛窗();
    });
    var 菜单 = 元("div", "表菜单");
    菜单.hidden = true;
    document.body.appendChild(菜单);
    var 开着的钮 = null;
    function 开菜单(钮, 画内容) {
      if (开着的钮 === 钮 && !菜单.hidden) {
        关菜单();
        return;
      }
      开着的钮 = 钮;
      菜单.innerHTML = "";
      画内容(菜单);
      菜单.hidden = false;
      var r = 钮.getBoundingClientRect();
      菜单.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 菜单.offsetWidth - 8)) + "px";
      菜单.style.top = Math.min(r.bottom + 6, window.innerHeight - 菜单.offsetHeight - 8) + "px";
    }
    function 关菜单() {
      菜单.hidden = true;
      开着的钮 = null;
    }
    document.addEventListener("click", function(e) {
      if (!菜单.hidden && !菜单.contains(e.target) && !(开着的钮 && 开着的钮.contains(e.target)))
        关菜单();
      if (!视单.hidden && !视包.contains(e.target))
        关视图();
    }, true);
    document.addEventListener("keydown", function(e) {
      if (e.key !== "Escape")
        return;
      if (!遮幕.hidden) {
        e.preventDefault();
        关筛窗();
        return;
      }
      if (!菜单.hidden || !视单.hidden) {
        关菜单();
        关视图();
        return;
      }
    });
    var 机表 = 选项.手机表 && window.UI手机表 ? 选项.手机表 : null, 机柄 = null;
    if (机表) {
      机柄 = window.UI手机表.工具(条, {
        筛数: function() {
          return 筛们.length;
        },
        表,
        键: 机表.键,
        排序: {
          项: function() {
            return (列序 || []).filter(function(i) {
              return !隐列[i];
            }).map(function(i) {
              return { f: String(i), 名: 列名(i) };
            });
          },
          取: function() {
            return 排序 ? { field: String(排序.列), dir: 排序.向 } : {};
          },
          设: function(f, dir) {
            排序 = { 列: Number(f), 向: dir };
            画();
          }
        }
      });
      var 看表态 = 表.classList.contains("机看表");
      new MutationObserver(function() {
        var 现 = 表.classList.contains("机看表");
        if (现 !== 看表态) {
          看表态 = 现;
          装冻结();
        }
      }).observe(表, { attributes: true, attributeFilter: ["class"] });
    }
    function 摆机卡() {
      if (!机表)
        return;
      var 头们 = Array.prototype.slice.call(头行.querySelectorAll("th[data-列]")), 角 = {};
      Object.keys(机表.角色 || {}).forEach(function(r) {
        角[r] = [].concat(机表.角色[r]).map(function(名) {
          var th = 头们.filter(function(t) {
            return t.dataset.名 === 名;
          })[0];
          return th ? th.dataset.列 : 名;
        });
      });
      window.UI手机表.卡片(表, 角);
    }
    function 列数() {
      return 头行.querySelectorAll("th:not(.勾列)").length;
    }
    function 列名(i) {
      var th = 头行.querySelector('th[data-列="' + i + '"]');
      return th ? th.dataset.名 || th.textContent.replace(/[✎↑↓↕]/g, "").trim() : "第 " + (i + 1) + " 列";
    }
    function 行们() {
      return Array.prototype.filter.call(表.querySelectorAll("tbody tr"), function(tr) {
        return !tr.querySelector("td[colspan]");
      });
    }
    function 行可见(tr) {
      return !tr.hidden && tr.getClientRects().length > 0;
    }
    function 格文(tr, i) {
      var td = tr.querySelector('[data-列="' + i + '"]');
      return td ? td.dataset.值 != null ? td.dataset.值 : (td.textContent || "").trim() : "";
    }
    function 格字(n) {
      if (n.nodeType === 3)
        return n.nodeValue;
      if (n.nodeType !== 1)
        return "";
      if (n.tagName === "SELECT") {
        var o = n.options[n.selectedIndex];
        return o ? " " + o.textContent + " " : "";
      }
      return Array.prototype.map.call(n.childNodes, 格字).join("");
    }
    function 搜文(tr) {
      return Array.prototype.map.call(tr.children, function(td) {
        if (td.classList.contains("勾列"))
          return "";
        return td.dataset.值 != null ? td.dataset.值 : 格字(td);
      }).join(" ");
    }
    function 行键(tr) {
      return 选项.行键 ? 选项.行键(tr) : tr.dataset.task || tr.dataset.原序 || "";
    }
    function 列型(i) {
      var 值 = 行们().map(function(tr) {
        return 格文(tr, i);
      }).filter(Boolean);
      if (!值.length)
        return "文";
      if (值.every(function(s) {
        return /^\d{4}-\d{2}-\d{2}/.test(s);
      }))
        return "日期";
      if (值.every(function(s) {
        return /^-?[\d,]+(\.\d+)?$/.test(s);
      }))
        return "数";
      return "文";
    }
    function 重扫() {
      var 头们 = Array.prototype.slice.call(头行.querySelectorAll("th"));
      var 列们 = Array.prototype.slice.call(列组.querySelectorAll("col"));
      var 有勾头 = 头们.length && 头们[0].classList.contains("勾列");
      var 数据头 = 有勾头 ? 头们.slice(1) : 头们;
      var 数据列 = 列们.length && 列们[0].dataset.列 === "勾列" ? 列们.slice(1) : 列们;
      数据头.forEach(function(th, i) {
        if (th.dataset.列 === undefined)
          th.dataset.列 = i;
        if (!th.dataset.名)
          th.dataset.名 = th.textContent.replace(/[✎↑↓↕]/g, "").trim();
      });
      数据列.forEach(function(c, i) {
        if (c.dataset.列 === undefined)
          c.dataset.列 = i;
        if (!c.dataset.原宽)
          c.dataset.原宽 = (c.style.width || "").replace("px", "") || "0";
      });
      if (可勾 && !有勾头) {
        var 全勾 = document.createElement("input");
        全勾.type = "checkbox";
        全勾.setAttribute("aria-label", "勾上屏上这些行");
        全勾.addEventListener("change", function() {
          var 可见 = 行们().filter(行可见);
          可见.filter(能勾).forEach(function(tr) {
            if (全勾.checked)
              选中.add(行键(tr));
            else
              选中.delete(行键(tr));
          });
          通知();
          画();
        });
        var 勾头 = 元("th", "勾列");
        勾头.dataset.列 = "勾列";
        勾头.title = "勾上屏上这些行,一次处理好几" + 位;
        勾头.appendChild(全勾);
        勾头.addEventListener("click", function(e) {
          e.stopPropagation();
          if (e.target !== 全勾 && !全勾.disabled) {
            全勾.checked = !全勾.checked;
            全勾.dispatchEvent(new Event("change"));
          }
        });
        头行.insertBefore(勾头, 头行.firstChild);
        var 勾列 = document.createElement("col");
        勾列.dataset.列 = "勾列";
        勾列.style.width = 勾选列宽 + "px";
        列组.insertBefore(勾列, 列组.firstChild);
      }
      var 共 = 列数();
      Array.prototype.forEach.call(表.querySelectorAll("tbody tr"), function(tr, i) {
        tr.dataset.原序 = i;
        var 独 = tr.querySelector("td[colspan]");
        if (独) {
          独.colSpan = 共 + (可勾 ? 1 : 0);
          return;
        }
        Array.prototype.forEach.call(tr.children, function(td, k) {
          if (td.dataset.列 === undefined)
            td.dataset.列 = k;
        });
        if (可勾 && !tr.querySelector("td.勾列")) {
          var box = document.createElement("input");
          box.type = "checkbox";
          box.setAttribute("aria-label", "勾这一" + 位 + " " + 行键(tr));
          box.dataset.test = "select:" + 行键(tr);
          box.checked = 勾着(tr);
          box.disabled = !能勾(tr);
          box.addEventListener("change", function() {
            if (box.checked)
              选中.add(行键(tr));
            else
              选中.delete(行键(tr));
            通知();
            画();
          });
          var 格 = 元("td", "勾列");
          格.dataset.列 = "勾列";
          格.appendChild(box);
          格.addEventListener("click", function(e) {
            e.stopPropagation();
            if (e.target !== box && !box.disabled) {
              box.checked = !box.checked;
              box.dispatchEvent(new Event("change"));
            }
          });
          tr.insertBefore(格, tr.firstChild);
        }
      });
      if (!列序 || 列序.length !== 共)
        列序 = Array.from({ length: 共 }, function(_, i) {
          return i;
        });
      挂表头();
      画();
    }
    function 挂表头() {
      头行.querySelectorAll("th[data-列]").forEach(function(th) {
        if (th.dataset.列 === "勾列" || th.dataset.挂了)
          return;
        th.dataset.挂了 = "1";
        th.classList.add("能排");
        var 记 = 元("span", "排号", "↕");
        th.appendChild(记);
        th.title = (th.title ? th.title + "  ·  " : "") + "点这个列名按这一列排:第一下从小到大,第二下从大到小,第三下回到原来的顺序。";
        th.addEventListener("click", function() {
          var i = Number(th.dataset.列);
          if (!排序 || 排序.列 !== i)
            排序 = { 列: i, 向: 1 };
          else if (排序.向 === 1)
            排序 = { 列: i, 向: -1 };
          else
            排序 = null;
          画();
        });
      });
    }
    function 画() {
      var 共 = 列数();
      var 排DOM = function(父, 取) {
        列序.forEach(function(i) {
          var e = 取(父, i);
          if (e)
            父.appendChild(e);
        });
      };
      排DOM(列组, function(p, i) {
        return p.querySelector('col[data-列="' + i + '"]');
      });
      排DOM(头行, function(p, i) {
        return p.querySelector('th[data-列="' + i + '"]');
      });
      Array.prototype.forEach.call(表.querySelectorAll("tbody tr"), function(tr) {
        if (tr.querySelector("td[colspan]"))
          return;
        排DOM(tr, function(p, i) {
          return p.querySelector('td[data-列="' + i + '"]');
        });
      });
      var 宽和 = 可勾 ? 勾选列宽 : 0;
      for (var i = 0;i < 共; i++) {
        var 藏 = !!隐列[i];
        var th = 头行.querySelector('th[data-列="' + i + '"]');
        var col = 列组.querySelector('col[data-列="' + i + '"]');
        if (th)
          th.hidden = 藏;
        if (col) {
          col.style.width = 藏 ? "0px" : col.dataset.原宽 + "px";
          if (!藏)
            宽和 += Number(col.dataset.原宽 || 0);
        }
        表.querySelectorAll('tbody td[data-列="' + i + '"]').forEach(function(td) {
          td.hidden = 藏;
        });
      }
      表.style.width = 宽和 + "px";
      表.style.minWidth = 宽和 + "px";
      var 词 = 搜词.trim().toLowerCase(), 留 = 0, 总 = 0;
      var 号 = /^([a-z]{2})0*(\d+)$/.exec(词), 号词 = 号 ? 号[1] + (号[2].length < 4 ? ("000" + 号[2]).slice(-4) : 号[2]) : "";
      行们().forEach(function(tr) {
        总++;
        var 过 = true;
        if (词) {
          var 全 = 搜文(tr).toLowerCase();
          过 = 全.indexOf(词) >= 0 || !!号词 && 全.indexOf(号词) >= 0;
        }
        if (过)
          过 = 筛们.every(function(f) {
            var v = 格文(tr, f.列), 值 = String(f.值 == null ? "" : f.值);
            if (f.条 === "为空")
              return !v;
            if (f.条 === "不为空")
              return !!v;
            if (!值)
              return true;
            if (f.条 === "含有")
              return v.indexOf(值) >= 0;
            if (f.条 === "不含")
              return v.indexOf(值) < 0;
            if (f.条 === "等于")
              return v === 值;
            if (f.条 === "不等于")
              return v !== 值;
            return true;
          });
        tr.hidden = !过;
        if (过)
          留++;
      });
      var 体 = 表.querySelector("tbody");
      var 排队 = 行们().slice();
      if (排序) {
        var 型 = 列型(排序.列);
        排队.sort(function(a, b) {
          var x = 格文(a, 排序.列), y = 格文(b, 排序.列);
          if (!x && !y)
            return 0;
          if (!x)
            return 1;
          if (!y)
            return -1;
          var d = 型 === "数" ? parseFloat(x.replace(/,/g, "")) - parseFloat(y.replace(/,/g, "")) : x.localeCompare(y, "zh-CN");
          return d * 排序.向;
        });
      } else {
        排队.sort(function(a, b) {
          return Number(a.dataset.原序) - Number(b.dataset.原序);
        });
      }
      排队.forEach(function(tr) {
        体.appendChild(tr);
      });
      头行.querySelectorAll("th[data-列]").forEach(function(th) {
        var 记 = th.querySelector(".排号");
        if (!记)
          return;
        var 中 = 排序 && String(排序.列) === th.dataset.列;
        th.classList.toggle("排上了", !!中);
        记.textContent = 中 ? 排序.向 === 1 ? "↑" : "↓" : "↕";
      });
      摆机卡();
      装冻结();
      摆两条(留, 总);
      摆空话(留, 总);
      画效条();
      写存(存根 + "-当前", 态());
    }
    function 摆空话(留, 总) {
      var 体 = 表.querySelector("tbody");
      if (!体)
        return;
      var 行 = 体.querySelector("tr.筛空");
      if (留 > 0 || 总 === 0) {
        if (行)
          行.remove();
        return;
      }
      if (!行) {
        行 = 元("tr", "筛空");
        var 格 = document.createElement("td");
        var 块 = 元("div", "空");
        块.appendChild(元("p", "空话", 选项.空话 || "没有符合这些条件的" + 位));
        var 清 = 元("button", "mini", "全清掉");
        清.type = "button";
        清.title = "把搜的词和所有筛选条件一起去掉,这张清单就全回来了。";
        清.addEventListener("click", function() {
          搜词 = "";
          搜框.value = "";
          筛们 = [];
          画筛选板();
          画();
        });
        块.appendChild(清);
        格.appendChild(块);
        行.appendChild(格);
      }
      行.firstChild.colSpan = Array.prototype.filter.call(头行.children, function(th) {
        return !th.hidden;
      }).length || 1;
      体.appendChild(行);
    }
    var 窄屏 = window.matchMedia ? window.matchMedia("(max-width:640px)") : null;
    function 装冻结() {
      表.querySelectorAll(".冻,.冻末").forEach(function(e) {
        e.classList.remove("冻", "冻末");
        e.style.left = "";
      });
      还原截();
      if (!冻结)
        return;
      var 可见头 = Array.prototype.filter.call(头行.children, function(th) {
        return !th.hidden;
      });
      var 钉数 = Math.min(冻结 + (可勾 ? 1 : 0), 可见头.length);
      var 宽们 = 可见头.map(function(th) {
        return th.getBoundingClientRect().width;
      });
      var 和 = function(n) {
        return 宽们.slice(0, n).reduce(function(a, b) {
          return a + b;
        }, 0);
      };
      var 框 = 表.parentElement;
      if (窄屏 && 窄屏.matches && 框 && !表.matches(".机卡表:not(.机看表)")) {
        var 顶 = 框.clientWidth * 0.4 - 框.clientLeft;
        if (和(钉数) > 顶) {
          钉数 = Math.min(1 + (可勾 ? 1 : 0), 可见头.length);
          if (和(钉数) > 顶)
            宽们[钉数 - 1] = 截列(可见头[钉数 - 1], Math.max(24, Math.floor(顶 - 和(钉数 - 1))));
        }
      }
      var 各行 = [头行].concat(行们());
      var 左 = 0;
      for (var k = 0;k < 钉数; k++) {
        var 宽 = 宽们[k];
        (function(k, 左) {
          各行.forEach(function(r) {
            var 可见 = Array.prototype.filter.call(r.children, function(c) {
              return !c.hidden;
            });
            var c = 可见[k];
            if (!c)
              return;
            c.classList.add("冻");
            if (k === 钉数 - 1)
              c.classList.add("冻末");
            c.style.left = 左 + "px";
          });
        })(k, 左);
        左 += 宽;
      }
    }
    function 截列(th, 宽) {
      var col = 列组.querySelector('col[data-列="' + th.dataset.列 + '"]');
      var 原 = th.getBoundingClientRect().width;
      if (!col || 宽 >= 原)
        return 原;
      var 表宽 = parseFloat(表.style.width) || 表.offsetWidth;
      col.dataset.截前 = col.style.width;
      col.style.width = 宽 + "px";
      col.dataset.截后 = col.style.width;
      表.dataset.截前宽 = 表.style.width;
      表.dataset.截前最小 = 表.style.minWidth;
      表.style.width = 表.style.minWidth = Math.round(表宽 - (原 - 宽)) + "px";
      表.dataset.截后宽 = 表.style.width;
      表.querySelectorAll('[data-列="' + th.dataset.列 + '"]').forEach(function(c) {
        if (c.tagName === "COL")
          return;
        c.dataset.截样 = JSON.stringify([c.style.width, c.style.maxWidth, c.style.minWidth]);
        c.style.width = c.style.maxWidth = 宽 + "px";
        c.style.minWidth = "0";
        c.classList.add("冻截");
        if (!c.title) {
          c.title = (c.dataset.名 || c.textContent || "").replace(/[↕↑↓]/g, "").trim();
          c.dataset.截题 = "1";
        }
      });
      return 宽;
    }
    function 还原截() {
      var col = 列组.querySelector("col[data-截前]");
      if (col) {
        if (col.style.width === col.dataset.截后)
          col.style.width = col.dataset.截前;
        if (表.style.width === 表.dataset.截后宽) {
          表.style.width = 表.dataset.截前宽;
          表.style.minWidth = 表.dataset.截前最小;
        }
        delete col.dataset.截前;
        delete col.dataset.截后;
        delete 表.dataset.截前宽;
        delete 表.dataset.截前最小;
        delete 表.dataset.截后宽;
      }
      表.querySelectorAll(".冻截").forEach(function(c) {
        c.classList.remove("冻截");
        if (c.dataset.截题) {
          c.removeAttribute("title");
          delete c.dataset.截题;
        }
        if (c.dataset.截样) {
          var 样 = JSON.parse(c.dataset.截样);
          c.style.width = 样[0];
          c.style.maxWidth = 样[1];
          c.style.minWidth = 样[2];
          delete c.dataset.截样;
        }
      });
    }
    function 摆两条(留, 总) {
      var 选们 = 取选中();
      壳.classList.toggle("已勾", 已选数() > 0);
      筛钮.classList.toggle("开着", 筛们.length > 0);
      筛钮.textContent = 筛们.length ? "筛选 " + 筛们.length : "筛选";
      if (机柄)
        机柄.刷();
      var 藏数 = Object.keys(隐列).filter(function(k) {
        return 隐列[k];
      }).length;
      列钮.classList.toggle("开着", 藏数 > 0);
      列钮.textContent = 藏数 ? "列 " + (列数() - 藏数) + "/" + 列数() : "列";
      冻钮.classList.toggle("开着", 冻结 > 0);
      视钮.classList.toggle("开着", !!当前视图名);
      画视钮();
      摆已改();
      计数.textContent = 留 === 总 ? "" : 留 + " / " + 总 + " " + 位;
      计数.title = 留 === 总 ? "" : "筛完剩下 " + 留 + " " + 位 + ",一共 " + 总 + " " + 位 + "。";
      var 全勾 = 头行.querySelector("th.勾列 input");
      if (全勾) {
        var 可见 = 行们().filter(行可见).filter(能勾);
        var 勾数 = 可见.filter(勾着).length;
        全勾.disabled = !可见.length;
        全勾.checked = 可见.length > 0 && 勾数 === 可见.length;
        全勾.indeterminate = 勾数 > 0 && 勾数 < 可见.length;
      }
      表.querySelectorAll("tbody tr").forEach(function(tr) {
        var 勾了 = 勾着(tr), 框 = tr.querySelector("td.勾列 input");
        tr.classList.toggle("选中", 勾了);
        if (框)
          框.checked = 勾了;
      });
      画批量条(选们);
    }
    function 画批量条(选们) {
      批.innerHTML = "";
      var 数 = 已选数(), 藏着 = 数 - 选们.length;
      var 题 = 元("span", "已选", "已选 " + 数 + " " + 位 + (藏着 > 0 ? "(含当前未显示 " + 藏着 + " " + 位 + ")" : ""));
      题.title = "下面这几颗只对勾上的这 " + 数 + " " + 位 + "起作用。";
      批.appendChild(题);
      批.appendChild(造批钮("复制", "把这几份的内容按屏上的列抄进剪贴板,粘到 Excel 或聊天窗里都行。", false, false, function(行) {
        var 文 = 表文(行, "\t");
        抄走(文).then(function(成) {
          报(成 ? "抄走了 " + 行.length + " " + 位 : "这个浏览器不让抄,先导出 CSV 吧");
        });
      }));
      批.appendChild(造批钮("导出 CSV", "把这几份导成一个 CSV 文件,Excel 能直接打开。", false, false, function(行) {
        导出(行);
      }));
      批量们.forEach(function(b) {
        var 不够 = !!b.至少 && 选们.length < b.至少;
        var 钮 = 造批钮(typeof b.名 === "function" ? b.名() : b.名, b.悬浮 || "", !!b.要当心, !!b.还没接, 不够 ? function() {
          报(b.不够说 || "至少勾 " + b.至少 + " 份才能" + b.名);
        } : b.干, b.还没接);
        if (不够)
          钮.setAttribute("aria-disabled", "true");
        批.appendChild(钮);
      });
      var 取消 = 元("button", "取消", "取消选择");
      取消.type = "button";
      取消.title = "把勾都去掉,回到上面那排工具。";
      取消.addEventListener("click", function() {
        选中.clear();
        通知();
        画();
      });
      批.appendChild(取消);
    }
    function 造批钮(名, 悬, 当心, 没接, 干, 说没接) {
      var b = 元("button", "btn tiny" + (当心 ? " 要当心" : ""), (当心 ? "⚠ " : "") + 名);
      b.type = "button";
      b.title = 悬;
      if (没接) {
        b.setAttribute("aria-disabled", "true");
        b.title = 悬 || "";
      }
      b.addEventListener("click", function() {
        var 行 = 取选中();
        if (!行.length && !已选数())
          return;
        if (没接) {
          报(名 + "这颗还没接上后台,点了不会有事发生");
          return;
        }
        干(行);
      });
      return b;
    }
    function 可见列序() {
      return 列序.filter(function(i) {
        return !隐列[i];
      });
    }
    function 全部列序() {
      return 列序.slice();
    }
    function 表文(行, 分) {
      var 列 = 可见列序();
      var 头 = 列.map(function(i) {
        return 列名(i);
      });
      return [头.join(分)].concat(行.map(function(tr) {
        return 列.map(function(i) {
          return 格文(tr, i).replace(/[\t\r\n]+/g, " ");
        }).join(分);
      })).join(`
`);
    }
    function 导出(行) {
      var 列 = 全部列序();
      var 文 = "\uFEFF" + [列.map(function(i) {
        return CSV格(列名(i));
      }).join(",")].concat(行.map(function(tr) {
        return 列.map(function(i) {
          return CSV格(格文(tr, i).replace(/[\r\n]+/g, " "));
        }).join(",");
      })).join(`\r
`);
      try {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([文], { type: "text/csv;charset=utf-8" }));
        a.download = (选项.导出名 || "清单") + "-" + 今天() + ".csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function() {
          URL.revokeObjectURL(a.href);
        }, 4000);
        报("导出了 " + 行.length + " " + 位);
      } catch (e) {
        if (window.console)
          console.error(e);
        if (window.UI提示)
          window.UI提示("这一下没导出成,先复制报错", { 错: true, 报错: String(e), 位置: "表格 · 导出 CSV" });
        else
          报("这一下没导出成,过一会儿再试");
      }
    }
    function 取选中() {
      return 行们().filter(function(tr) {
        return 行可见(tr) && 勾着(tr);
      });
    }
    function 画筛选板() {
      筛板.innerHTML = "";
      if (!筛们.length)
        筛们.push({ 列: 列序[0], 条: "含有", 值: "" });
      筛们.forEach(function(f, n) {
        var 行 = 元("div", "表筛条");
        行.appendChild(元("span", "且", n === 0 ? "哪几行" : "并且"));
        var 列选 = document.createElement("select");
        列选.setAttribute("aria-label", "按哪一列筛");
        列序.forEach(function(i) {
          var o = document.createElement("option");
          o.value = i;
          o.textContent = 列名(i);
          if (i === f.列)
            o.selected = true;
          列选.appendChild(o);
        });
        列选.addEventListener("change", function() {
          f.列 = Number(列选.value);
          画();
        });
        var 条选 = document.createElement("select");
        条选.setAttribute("aria-label", "什么条件");
        条件们.forEach(function(c) {
          var o = document.createElement("option");
          o.value = c[0];
          o.textContent = c[0];
          if (c[0] === f.条)
            o.selected = true;
          条选.appendChild(o);
        });
        var 值框 = document.createElement("input");
        值框.setAttribute("aria-label", "值");
        值框.placeholder = "要找的字";
        值框.value = f.值 || "";
        值框.hidden = !要值(f.条);
        条选.addEventListener("change", function() {
          f.条 = 条选.value;
          值框.hidden = !要值(f.条);
          画();
        });
        值框.addEventListener("input", function() {
          f.值 = 值框.value;
          画();
        });
        var 去 = 元("button", "去掉", "✗");
        去.type = "button";
        去.title = "去掉这一条";
        去.setAttribute("aria-label", "去掉这一条");
        去.addEventListener("click", function() {
          筛们.splice(n, 1);
          画筛选板();
          画();
        });
        行.append(列选, 条选, 值框, 去);
        筛板.appendChild(行);
      });
      var 脚 = 元("div", "表筛脚");
      var 加 = 元("button", "mini", "＋ 再加一条");
      加.type = "button";
      加.title = "再加一条条件。几条一起用时,每一条都得满足。";
      加.addEventListener("click", function() {
        筛们.push({ 列: 列序[0], 条: "含有", 值: "" });
        画筛选板();
        画();
      });
      var 清 = 元("button", "mini", "全清掉");
      清.type = "button";
      清.title = "把所有筛选条件去掉,清单全回来。";
      清.addEventListener("click", function() {
        筛们 = [];
        画筛选板();
        画();
      });
      var 用 = 元("button", "mini", "用这些条件");
      用.type = "button";
      用.title = "照现在这些条件筛,关掉这个窗。";
      用.addEventListener("click", function() {
        画();
        关筛窗();
      });
      var 说 = 元("span", "smallnote", "几条都得满足");
      说.title = "写了几条就是「并且」:一行要同时满足所有条件才留下。";
      脚.append(加, 清, 用, 说);
      筛板.appendChild(脚);
    }
    function 要值(条) {
      for (var i = 0;i < 条件们.length; i++)
        if (条件们[i][0] === 条)
          return 条件们[i][1];
      return true;
    }
    function 生效筛们() {
      return 筛们.filter(function(f) {
        return 要值(f.条) ? String(f.值 == null ? "" : f.值).trim() !== "" : true;
      });
    }
    function 画效条() {
      效条.innerHTML = "";
      var 有们 = 生效筛们();
      有们.forEach(function(f) {
        var 文 = 列名(f.列) + " " + f.条 + (要值(f.条) ? " " + String(f.值 == null ? "" : f.值).trim() : "");
        var 签 = 元("span", "筛签", 文);
        签.title = "正在按这一条筛:" + 文;
        var 去 = 元("button", "", "✗");
        去.type = "button";
        去.title = "去掉这一条";
        去.setAttribute("aria-label", "去掉这一条");
        去.addEventListener("click", function() {
          筛们.splice(筛们.indexOf(f), 1);
          if (!遮幕.hidden)
            画筛选板();
          画();
        });
        签.appendChild(去);
        效条.appendChild(签);
      });
      if (有们.length) {
        var 清 = 元("button", "清空", "清空");
        清.type = "button";
        清.title = "把所有条件去掉,清单全回来。";
        清.addEventListener("click", function() {
          筛们 = [];
          if (!遮幕.hidden)
            画筛选板();
          画();
        });
        效条.appendChild(清);
      }
      效条.hidden = !有们.length;
    }
    列钮.addEventListener("click", function() {
      开菜单(列钮, function(m) {
        m.appendChild(元("h4", "", "显示哪几列 · 谁在前"));
        列序.forEach(function(i, n) {
          var 条目 = 元("div", "条");
          var 抓 = 元("span", "抓", "⠿");
          抓.title = "按住拖动换顺序";
          var lab = document.createElement("label");
          var box = document.createElement("input");
          box.type = "checkbox";
          box.checked = !隐列[i];
          var 锁 = 不可隐.indexOf(列名(i)) >= 0;
          if (锁) {
            box.disabled = true;
            lab.title = "这一列是认出每一行的那一列,不许藏。";
          }
          box.addEventListener("change", function() {
            if (box.checked)
              delete 隐列[i];
            else
              隐列[i] = true;
            画();
          });
          lab.append(box, document.createTextNode(列名(i)));
          var 上 = 元("button", "挪", "▲");
          上.type = "button";
          上.title = "往前挪一列";
          上.disabled = n === 0;
          var 下 = 元("button", "挪", "▼");
          下.type = "button";
          下.title = "往后挪一列";
          下.disabled = n === 列序.length - 1;
          上.addEventListener("click", function() {
            换位(n, n - 1);
          });
          下.addEventListener("click", function() {
            换位(n, n + 1);
          });
          条目.draggable = true;
          条目.addEventListener("dragstart", function(e) {
            e.dataTransfer.setData("text/plain", String(n));
            条目.classList.add("拖中");
          });
          条目.addEventListener("dragend", function() {
            条目.classList.remove("拖中");
          });
          条目.addEventListener("dragover", function(e) {
            e.preventDefault();
          });
          条目.addEventListener("drop", function(e) {
            e.preventDefault();
            换位(Number(e.dataTransfer.getData("text/plain")), n);
          });
          条目.append(抓, lab, 上, 下);
          m.appendChild(条目);
        });
        var 全显 = 元("button", "整条", "全部显示");
        全显.type = "button";
        全显.title = "把藏起来的列都显示出来,列的先后不动。";
        全显.addEventListener("click", function() {
          隐列 = {};
          关菜单();
          画();
        });
        var 复原 = 元("button", "整条", "恢复默认");
        复原.type = "button";
        复原.title = "列的显示、顺序、钉住几列都回到刚装好时那样。";
        复原.addEventListener("click", function() {
          隐列 = {};
          列序 = Array.from({ length: 列数() }, function(_, i) {
            return i;
          });
          冻结 = 0;
          关菜单();
          画();
        });
        m.appendChild(元("div", "分"));
        m.appendChild(全显);
        m.appendChild(复原);
      });
    });
    function 换位(a, b) {
      if (b < 0 || b >= 列序.length)
        return;
      var t = 列序[a];
      列序[a] = 列序[b];
      列序[b] = t;
      画();
      列钮.click();
      列钮.click();
    }
    冻钮.addEventListener("click", function() {
      开菜单(冻钮, function(m) {
        m.appendChild(元("h4", "", "横着拉的时候钉住谁"));
        [[0, "不冻结"], [1, "冻结首列"], [2, "冻结前 2 列"]].forEach(function(档) {
          var b = 元("button", "整条" + (冻结 === 档[0] ? " 选了" : ""), (冻结 === 档[0] ? "✓ " : "　") + 档[1]);
          b.type = "button";
          b.title = 档[0] ? "横着拉表格时,最左边这 " + 档[0] + " 列不跟着跑。" : "横着拉时所有列一起跑。";
          b.addEventListener("click", function() {
            冻结 = 档[0];
            关菜单();
            画();
          });
          m.appendChild(b);
        });
      });
    });
    var 当前视图名 = "", 已改包 = null;
    function 态() {
      return { 搜: 搜词, 筛: 筛们, 排: 排序, 隐: 隐列, 序: 列序, 冻: 冻结, 名: 当前视图名 };
    }
    function 套态(t) {
      if (!t)
        return;
      if (Array.isArray(t.序) && t.序.length !== 列数())
        return;
      搜词 = t.搜 || "";
      搜框.value = 搜词;
      筛们 = Array.isArray(t.筛) ? t.筛 : [];
      排序 = t.排 || null;
      隐列 = t.隐 || {};
      冻结 = t.冻 || 0;
      当前视图名 = t.名 || "";
      if (Array.isArray(t.序))
        列序 = t.序.slice();
      if (!遮幕.hidden)
        画筛选板();
    }
    function 视图们() {
      return 取存(存根 + "-视图们") || [];
    }
    function 找视图(名) {
      var 有 = 视图们().filter(function(v) {
        return v.名 === 名;
      });
      return 有.length ? 有[0] : null;
    }
    function 空名(底) {
      var 根 = String(底 || "这套看法"), 名 = 根;
      for (var n = 2;找视图(名); n++)
        名 = 根 + " " + n;
      return 名;
    }
    function 指纹(t) {
      var 筛 = (t.筛 || []).filter(function(f) {
        return 要值(f.条) ? String(f.值 == null ? "" : f.值).trim() !== "" : true;
      });
      return JSON.stringify({ 搜: t.搜 || "", 筛, 排: t.排 || null, 隐: t.隐 || {}, 序: t.序 || [], 冻: t.冻 || 0 });
    }
    function 改了没() {
      if (!当前视图名)
        return false;
      var v = 找视图(当前视图名);
      if (!v)
        return false;
      return 指纹(态()) !== 指纹(v.态);
    }
    function 开视图(预) {
      关菜单();
      视单.innerHTML = "";
      画视图单(预 == null ? null : 预);
      视单.hidden = false;
      视钮.setAttribute("aria-expanded", "true");
    }
    function 关视图() {
      视单.hidden = true;
      视钮.setAttribute("aria-expanded", "false");
    }
    视钮.addEventListener("click", function() {
      if (视单.hidden)
        开视图();
      else
        关视图();
    });
    function 画视钮() {
      视钮.textContent = "视图:";
      视钮.appendChild(元("b", "", 当前视图名 || "临时"));
      视钮.appendChild(document.createTextNode(" ▾"));
    }
    function 画视图单(预) {
      var 存着的 = 视图们();
      视单.appendChild(元("div", "段名", 存着的.length ? "我存的" : "还没存过"));
      存着的.forEach(function(v, n) {
        var 是 = 当前视图名 === v.名;
        var 项 = 元("div", "项" + (是 ? " 当前" : ""));
        if (是)
          项.setAttribute("aria-current", "true");
        var 名 = 元("button", "名", v.名);
        名.type = "button";
        名.title = "切到这套看法。";
        名.addEventListener("click", function() {
          套态(v.态);
          关视图();
          画();
        });
        var 删 = 元("button", "删", "✗");
        删.type = "button";
        删.title = "删掉这套看法。库里的东西一个字节都不动。";
        删.addEventListener("click", function() {
          var 新 = 视图们().filter(function(x, k) {
            return k !== n;
          });
          写存(存根 + "-视图们", 新);
          if (当前视图名 === v.名)
            当前视图名 = "";
          开视图();
          画();
        });
        项.append(名, 删);
        视单.appendChild(项);
      });
      视单.appendChild(元("div", "隔"));
      var 加位 = 元("div");
      视单.appendChild(加位);
      var 放加 = function(预) {
        加位.innerHTML = "";
        加位.appendChild(预 == null ? 造加钮(放加) : 造存行(预));
      };
      放加(预);
      var 注 = 元("div", "段名", "只存在这台电脑");
      注.title = "视图存在这个浏览器里,换一台电脑或换个浏览器就没有了;清掉浏览器数据也会没。库里的东西一个字节都不受影响。";
      视单.appendChild(注);
    }
    function 造加钮(放加) {
      var 加 = 元("button", "项 加", "＋ 存成新的看法");
      加.type = "button";
      加.title = "把现在这套看法存成一条,下次一点就回来。";
      加.addEventListener("click", function() {
        放加("");
      });
      return 加;
    }
    function 造存行(预) {
      var 行 = 元("div", "项");
      var 名框 = document.createElement("input");
      名框.className = "搜";
      名框.type = "text";
      名框.placeholder = "这套看法叫什么";
      名框.setAttribute("aria-label", "这套看法叫什么");
      名框.value = 预 || "";
      var 存 = 元("button", "mini", "存下");
      存.type = "button";
      存.title = "把现在这套看法存在这台电脑的浏览器里。";
      var 存它 = function() {
        var 名 = 名框.value.trim();
        if (!名) {
          名框.focus();
          return;
        }
        var 新 = 视图们().filter(function(x) {
          return x.名 !== 名;
        });
        当前视图名 = 名;
        新.push({ 名, 态: 态() });
        写存(存根 + "-视图们", 新);
        关视图();
        报("存好了:" + 名);
        画();
      };
      存.addEventListener("click", 存它);
      名框.addEventListener("keydown", function(e) {
        if (e.key === "Enter")
          存它();
      });
      行.append(名框, 存);
      setTimeout(function() {
        名框.focus();
      }, 0);
      return 行;
    }
    function 摆已改() {
      if (改了没() && !已改包) {
        已改包 = 造已改();
        视包.insertBefore(已改包, 视单);
      } else if (!改了没() && 已改包) {
        已改包.remove();
        已改包 = null;
      }
    }
    function 造已改() {
      var 包 = 元("span", "已改");
      包.title = "这套看法改过了,还没存下来。";
      var 另 = 元("button", "", "另存");
      另.type = "button";
      另.title = "把现在这套存成新的一条,原来那条不动。";
      另.addEventListener("click", function() {
        开视图(空名(当前视图名));
      });
      var 还 = 元("button", "淡", "还原");
      还.type = "button";
      还.title = "丢掉现在这些改动,回到存下来的那套看法。";
      还.addEventListener("click", function() {
        var v = 找视图(当前视图名);
        if (!v)
          return;
        套态(v.态);
        关视图();
        画();
      });
      包.append(另, 还);
      return 包;
    }
    导钮.addEventListener("click", function() {
      var 行 = 取选中();
      if (!行.length)
        行 = 行们().filter(行可见);
      if (!行.length) {
        报("屏上没有可导出的行");
        return;
      }
      导出(行);
    });
    搜框.addEventListener("input", function() {
      搜词 = 搜框.value;
      画();
    });
    var 上次看法 = 取存(存根 + "-当前");
    重扫();
    套态(上次看法);
    画();
    window.addEventListener("resize", 装冻结);
    return {
      重扫,
      画,
      取选中,
      清选中: function() {
        选中.clear();
        通知();
        画();
      },
      设搜: function(s) {
        搜词 = s || "";
        搜框.value = 搜词;
        画();
      },
      设筛: function(列名要的, 条, 值) {
        var 序 = -1;
        for (var i = 0;i < 列数(); i++)
          if (列名(i) === 列名要的)
            序 = i;
        if (序 < 0)
          return;
        筛们 = 筛们.filter(function(f) {
          return f.列 !== 序;
        });
        if (值 !== null && 值 !== undefined && 值 !== "")
          筛们.push({ 列: 序, 条: 条 || "等于", 值 });
        if (!遮幕.hidden)
          画筛选板();
        画();
      }
    };
  };
})();

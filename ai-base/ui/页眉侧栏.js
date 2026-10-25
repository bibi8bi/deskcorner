(function() {
  if (window.UI布局)
    return;
  var 存 = {
    收: "ui:侧栏收",
    宽: "ui:侧栏宽",
    内宽: "ui:内层宽",
    内收: "ui:内层收",
    详情右宽: "ui:详情右宽"
  };
  function 读存(k, 缺) {
    try {
      var v = localStorage.getItem(k);
      return v === null ? 缺 : v;
    } catch (e) {
      return 缺;
    }
  }
  function 写存(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function 转义(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  var 字形 = {
    B: "M6 0 V64 M6 0 H30 A16 16 0 0 1 30 32 H6 M6 32 H32 A16 16 0 0 1 32 64 H6",
    O: "M28 0 A23 32 0 0 1 28 64 A23 32 0 0 1 28 0",
    T: "M0 0 H56 M28 0 V64",
    L: "M8 0 V64 H50",
    X: "M6 0 L50 64 M50 0 L6 64"
  };
  function 排一行(词) {
    var x = 0, 码 = "", 末 = 0;
    for (var i = 0;i < 词.length; i++) {
      if (!字形[词[i]])
        return null;
      码 += '<path transform="translate(' + x + ' 0)" d="' + 字形[词[i]] + '"/>';
      末 = x;
      x += 72;
    }
    return { 码, 宽: 末 + 56 };
  }
  function 建标志(名, 系列) {
    var 词 = String(系列).trim().toUpperCase().split(/\s+/);
    var 行 = 词.length > 2 ? [null] : 词.map(排一行);
    if (行.indexOf(null) >= 0)
      return '<span class="hd-标">' + 转义(系列) + "</span>";
    var 两 = 行.length === 2, 宽 = Math.max(两 ? 行[0].宽 * 0.6875 : 0, 行[两 ? 1 : 0].宽) + 14;
    return '<svg class="hd-标" width="' + Math.round(28 * 宽 / 140) + '" height="28" viewBox="-7 -7 ' + 宽 + ' 140" fill="none"' + ' stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"' + ' role="img" aria-label="' + 名 + '">' + (两 ? '<g transform="scale(0.6875)">' + 行[0].码 + '</g><g transform="translate(0 62)">' + 行[1].码 + "</g>" : '<g transform="translate(0 31)">' + 行[0].码 + "</g>") + "</svg>";
  }
  function 有侧栏(配置) {
    return !!(配置.侧栏 && 配置.侧栏.length);
  }
  function 同软件(去) {
    if (!/^(https?:)?\/\//i.test(String(去 == null ? "" : 去)))
      return false;
    try {
      return new URL(去, location.href).host === location.host;
    } catch (e) {
      return false;
    }
  }
  function 公网根() {
    var m = /^(?:p\d+|nav)\.([^.]+\..+)$/.exec(location.hostname || "");
    return m ? m[1] : "";
  }
  function 在公网() {
    return !!公网根();
  }
  function 公网址(去) {
    if (!在公网() || typeof 去 !== "string" || !/^(https?:)?\/\//i.test(去))
      return 去;
    try {
      var u = new URL(去, location.href);
      if (u.hostname !== location.hostname || !u.port)
        return 去;
      return "https://" + ("p" + u.port) + "." + 公网根() + u.pathname + u.search + u.hash;
    } catch (e) {
      return 去;
    }
  }
  function 本口() {
    if (location.port || !在公网())
      return location.port;
    var m = /^(?:p(\d+)|(nav))\./.exec(location.hostname);
    return m ? m[1] || "" : "";
  }
  function 改公网(配置) {
    if (!在公网())
      return 配置;
    function 项(it) {
      if (!it || typeof it !== "object")
        return it;
      var o = {}, k;
      for (k in it)
        o[k] = it[k];
      if ("去" in o)
        o.去 = 公网址(o.去);
      if (o.又)
        o.又 = o.又.map(公网址);
      if (o.锚点)
        o.锚点 = o.锚点.map(项);
      if (o.项)
        o.项 = o.项.map(项);
      return o;
    }
    var c = {}, k;
    for (k in 配置)
      c[k] = 配置[k];
    if (c.菜单)
      c.菜单 = c.菜单.map(项);
    if (c.侧栏)
      c.侧栏 = c.侧栏.map(项);
    if (typeof c.首页 === "string")
      c.首页 = 公网址(c.首页);
    return c;
  }
  function 同口岸(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s)
      return false;
    if (/^:?\d+$/.test(s))
      return 本口() === s.replace(/^:/, "");
    return 同软件(s);
  }
  function 这格是我(it) {
    if (!it)
      return false;
    if (同软件(it.去))
      return true;
    var 又 = it.又;
    if (!又 || !又.length)
      return false;
    for (var j = 0;j < 又.length; j++)
      if (同口岸(又[j]))
        return true;
    return false;
  }
  function 正文首块() {
    var n = document.querySelector(".wrap");
    while (n && n.parentNode !== document.body)
      n = n.parentNode;
    if (n)
      return n;
    var bar = document.getElementById("tophd");
    return bar ? bar.nextSibling : document.body.firstChild;
  }
  function 本页() {
    var p = location.pathname.split("/").pop();
    try {
      p = decodeURIComponent(p);
    } catch (e) {}
    return p || "index.html";
  }
  function 建顶栏(配置) {
    var 当前 = 配置.当前 || 本页();
    var bar = document.createElement("div");
    bar.id = "tophd";
    bar.className = "hd-bar";
    var 系列 = 配置.系列名 || "Toolbox";
    var 标名 = 转义(配置.站点 ? 系列 + " · " + 配置.站点 : 系列);
    var 单 = 配置.菜单 || [];
    var 亮 = -1, i;
    for (i = 0;i < 单.length; i++)
      if (这格是我(单[i])) {
        亮 = i;
        break;
      }
    if (亮 < 0) {
      for (i = 0;i < 单.length; i++)
        if (单[i].去 === 当前 || 单[i].id === 当前) {
          亮 = i;
          break;
        }
    }
    var 净 = String(当前).split("#")[0];
    if (亮 < 0 && 净 !== 当前) {
      for (i = 0;i < 单.length; i++)
        if (单[i].去 === 净 || 单[i].id === 净) {
          亮 = i;
          break;
        }
    }
    var 项 = 单.map(function(it, i) {
      var 中 = i === 亮 ? ' class="cur" aria-current="page"' : "";
      return '<a href="' + 转义(it.去) + '"' + 中 + ">" + 转义(it.字) + "</a>";
    }).join("");
    bar.innerHTML = '<div class="hd-in">' + (有侧栏(配置) ? '<button class="hd-汉堡" type="button" aria-label="展开左边那条" aria-expanded="false" aria-controls="side">☰</button>' : "") + (单.length ? '<button class="hd-切" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="hd-切单">' + '<span class="hd-切字">' + 转义(亮 >= 0 ? 单[亮].字 : 配置.站点 || 系列) + '</span><span aria-hidden="true">▾</span></button>' + '<div class="hd-切单" id="hd-切单" hidden>' + 单.map(function(it, i) {
      return '<a href="' + 转义(it.去) + '"' + (i === 亮 ? ' class="cur" aria-current="page"' : "") + ">" + 转义(it.字) + "</a>";
    }).join("") + "</div>" : "") + '<div class="hd-钟槽"></div>' + (配置.首页 === false ? '<span class="hd-site" title="' + 标名 + '">' + 建标志(标名, 系列) + "</span>" : '<a class="hd-site" href="' + 转义(配置.首页 || "index.html") + '"' + ' title="' + 标名 + ' 首页">' + 建标志(标名, 系列) + "</a>") + (!配置.站点 ? "" : '<span class="hd-名">' + 转义(配置.站点) + "</span>") + '<div class="hd-navwrap"><nav class="hd-nav">' + 项 + "</nav></div>" + '<span class="hd-撑"></span>' + '<span class="hd-右"></span>' + "</div>";
    document.body.insertBefore(bar, document.body.firstChild);
    function 量高() {
      document.documentElement.style.setProperty("--tophd-实", bar.offsetHeight + "px");
      document.documentElement.style.setProperty("--tophd-h", (document.body.classList.contains("顶栏藏") ? 0 : bar.offsetHeight) + "px");
    }
    量高();
    addEventListener("resize", 量高);
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(量高);
    var 划盒 = bar.querySelector(".hd-navwrap");
    var 划栏 = bar.querySelector(".hd-nav");
    function 划态() {
      var 余 = 划栏.scrollWidth - 划栏.clientWidth;
      划盒.classList.toggle("可左划", 划栏.scrollLeft > 2);
      划盒.classList.toggle("可右划", 余 > 2 && 划栏.scrollLeft < 余 - 2);
    }
    划栏.addEventListener("scroll", 划态, { passive: true });
    addEventListener("resize", 划态);
    var 名格 = bar.querySelector(".hd-名");
    function 站名让位() {
      if (!名格)
        return;
      名格.hidden = false;
      if (划栏.scrollWidth - 划栏.clientWidth > 2)
        名格.hidden = true;
      划态();
    }
    站名让位();
    addEventListener("resize", 站名让位);
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(站名让位);
    function 划到当前页() {
      var 当 = bar.querySelector(".hd-nav a.cur");
      if (!当)
        return 划态();
      var n = 划栏.getBoundingClientRect(), c = 当.getBoundingClientRect();
      if (c.right > n.right)
        划栏.scrollLeft += c.right - n.right + 30;
      else if (c.left < n.left)
        划栏.scrollLeft -= n.left - c.left + 30;
      划态();
    }
    划到当前页();
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(划到当前页);
    if (配置.切亮暗 !== false)
      建切亮暗(bar.querySelector(".hd-右"));
    装手机顶栏(bar, 有侧栏(配置), 量高);
    return bar;
  }
  function 装手机顶栏(bar, 有侧, 量高) {
    var 窄 = matchMedia("(max-width:640px)");
    var 切 = bar.querySelector(".hd-切"), 单 = bar.querySelector(".hd-切单");
    var 右 = bar.querySelector(".hd-右"), 槽 = bar.querySelector(".hd-钟槽");
    function 开单(开) {
      if (!单)
        return;
      单.hidden = !开;
      切.setAttribute("aria-expanded", 开 ? "true" : "false");
      if (开)
        收顶(false);
    }
    if (切) {
      切.onclick = function(e) {
        e.stopPropagation();
        开单(单.hidden);
      };
      document.addEventListener("click", function(e) {
        if (!单.hidden && !单.contains(e.target))
          开单(false);
      });
      addEventListener("keydown", function(e) {
        if (e.key === "Escape" && !单.hidden) {
          开单(false);
          切.focus();
        }
      });
    }
    if (!有侧) {
      if (单)
        单.appendChild(槽);
      else
        槽 = null;
    }
    var 挪着 = false;
    function 挪钟() {
      if (!槽)
        return;
      var 动 = false;
      if (窄.matches) {
        [].slice.call(右.children).forEach(function(el) {
          if (!el.classList.contains("hd-钮")) {
            槽.appendChild(el);
            动 = true;
          }
        });
      } else if (槽.children.length) {
        var 钮 = 右.querySelector(".hd-钮");
        [].slice.call(槽.children).forEach(function(el) {
          右.insertBefore(el, 钮);
        });
        动 = true;
      }
      if (动 && !挪着) {
        挪着 = true;
        try {
          dispatchEvent(new Event("resize"));
        } finally {
          挪着 = false;
        }
      }
    }
    if (槽 && window.MutationObserver)
      new MutationObserver(function() {
        if (窄.matches)
          挪钟();
      }).observe(右, { childList: true });
    挪钟();
    if (窄.addEventListener)
      窄.addEventListener("change", function() {
        挪钟();
        if (!窄.matches)
          收顶(false);
      });
    var 上次 = scrollY;
    function 收顶(藏) {
      if (document.body.classList.contains("顶栏藏") === 藏)
        return;
      document.body.classList.toggle("顶栏藏", 藏);
      量高();
    }
    addEventListener("scroll", function() {
      var y = scrollY, 差 = y - 上次;
      上次 = y;
      if (!窄.matches || document.body.classList.contains("侧栏滑出") || 单 && !单.hidden)
        return;
      if (y <= bar.offsetHeight)
        收顶(false);
      else if (差 > 6)
        收顶(true);
      else if (差 < -6)
        收顶(false);
    }, { passive: true });
    bar.addEventListener("focusin", function() {
      收顶(false);
    });
  }
  function 建切亮暗(槽) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "hd-钮";
    var 序 = ["light", "dark", "eye"];
    var 符 = { light: "☀", dark: "☾", eye: "护" };
    var 叫 = { light: "亮色", dark: "暗色", eye: "护眼" };
    function 现在() {
      var 记 = document.documentElement.getAttribute("data-theme");
      if (序.indexOf(记) >= 0)
        return 记;
      return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    function 下一个() {
      return 序[(序.indexOf(现在()) + 1) % 序.length];
    }
    function 同步() {
      b.textContent = 符[现在()];
      b.title = "现在是" + 叫[现在()] + ",点一下换" + 叫[下一个()];
      b.setAttribute("aria-label", b.title);
    }
    b.onclick = function() {
      var 下 = 下一个();
      document.documentElement.setAttribute("data-theme", 下);
      写存("ui:主题", 下);
      同步();
    };
    同步();
    槽.appendChild(b);
  }
  function 建侧栏(配置) {
    var 当前 = 配置.当前 || 本页();
    var side = document.createElement("aside");
    side.id = "side";
    var 身 = (配置.侧栏 || []).map(function(g) {
      var 项 = (g.项 || []).map(function(it) {
        var 中 = it.去 === 当前 || it.id === 当前;
        var 名 = it.字 + (it.说明 ? " —— " + it.说明 : "");
        var 图 = it.图 || Array.from(String(it.字 || ""))[0] || "·";
        var 串 = '<a class="side-项' + (中 ? " cur" : "") + '" href="' + 转义(it.去 || "#") + '"' + ' title="' + 转义(名) + '" aria-label="' + 转义(名) + '"' + (中 ? ' aria-current="page"' : "") + ">" + '<span class="side-ic" aria-hidden="true">' + 转义(图) + "</span>" + '<span class="side-字">' + 转义(it.字) + "</span></a>";
        if (中 && it.锚点 && it.锚点.length) {
          串 += '<div class="side-锚组">' + it.锚点.map(function(a) {
            return '<a class="side-项 side-锚" href="' + 转义(a.去 || "#") + '"' + ' title="' + 转义(a.字) + '">' + 转义(a.字) + "</a>";
          }).join("") + "</div>";
        }
        return 串;
      }).join("");
      return '<div class="side-组">' + (g.组 ? '<div class="side-组名">' + 转义(g.组) + "</div>" : "") + 项 + "</div>";
    }).join("");
    side.innerHTML = '<nav class="side-身" aria-label="' + 转义((配置.站点 || "") + "本模块的页") + '">' + 身 + "</nav>" + '<button class="side-收" type="button" title="收起 / 展开左边这条"' + ' aria-label="收起或展开左边这条" aria-controls="side" aria-expanded="true">«</button>' + '<span class="side-把手" title="拖着改宽"></span>';
    document.body.insertBefore(side, 正文首块());
    document.body.classList.add("有侧栏");
    var 存宽 = parseInt(读存(存.宽, ""), 10);
    if (存宽 >= 150 && 存宽 <= 480)
      设宽(存宽);
    side.querySelector(".side-收").onclick = function() {
      收放(!收着());
    };
    if (读存(存.收, 配置.侧栏默认收 ? "1" : "0") === "1")
      收放(true, true);
    拖宽(side.querySelector(".side-把手"), function(px) {
      px = Math.max(150, Math.min(480, px));
      设宽(px);
      写存(存.宽, px);
    }, function() {
      return side.getBoundingClientRect().width;
    });
    return side;
  }
  function 设宽(px) {
    document.documentElement.style.setProperty("--侧栏宽", px + "px");
  }
  function 收着() {
    return document.body.classList.contains("侧栏收");
  }
  function 收放(收, 不记) {
    document.body.classList.toggle("侧栏收", !!收);
    if (!不记)
      写存(存.收, 收 ? "1" : "0");
    var 钮 = document.querySelector("#side .side-收");
    if (钮)
      钮.setAttribute("aria-expanded", 收 ? "false" : "true");
    告诉页面();
  }
  function 告诉页面() {
    requestAnimationFrame(function() {
      try {
        dispatchEvent(new Event("resize"));
      } catch (e) {}
    });
  }
  function 装内层(配置) {
    var el = typeof 配置.内层 === "string" ? document.querySelector(配置.内层) : 配置.内层;
    if (!el)
      return null;
    var 盒 = document.createElement("div");
    盒.className = "side-内层";
    盒.id = "side内层";
    盒.innerHTML = '<div class="side-内层头">' + "<span>" + 转义(配置.内层名 || "") + "</span>" + '<button class="side-内收" type="button" title="收起 / 展开这一列" aria-label="收起或展开这一列"' + ' aria-controls="side内层" aria-expanded="true">«</button>' + "</div>";
    document.body.insertBefore(盒, 正文首块());
    盒.appendChild(el);
    var 把 = document.createElement("span");
    把.className = "side-把手";
    把.title = "拖着改宽";
    盒.appendChild(把);
    document.body.classList.add("有内层");
    var 存宽 = parseInt(读存(存.内宽, ""), 10);
    if (存宽 >= 150 && 存宽 <= 480)
      设内宽(存宽);
    if (读存(存.内收, "0") === "1")
      document.body.classList.add("内层收");
    var 内收钮 = 盒.querySelector(".side-内收");
    内收钮.setAttribute("aria-expanded", document.body.classList.contains("内层收") ? "false" : "true");
    内收钮.onclick = function() {
      var 收 = !document.body.classList.contains("内层收");
      document.body.classList.toggle("内层收", 收);
      写存(存.内收, 收 ? "1" : "0");
      内收钮.setAttribute("aria-expanded", 收 ? "false" : "true");
      告诉页面();
    };
    拖宽(把, function(px) {
      设内宽(px);
      写存(存.内宽, px);
    }, function() {
      return 盒.getBoundingClientRect().width;
    }, 设内宽);
    return 盒;
  }
  function 设内宽(px) {
    px = Math.max(150, Math.min(480, px));
    document.documentElement.style.setProperty("--内层宽", px + "px");
  }
  function 拖宽(把手, 落, 现宽, 另设宽, 限) {
    if (!把手)
      return;
    限 = 限 || {};
    var 小 = 限.小 || 150, 大 = 限.大 || 480, 告 = 限.静 ? function() {} : 告诉页面;
    var 起X = 0, 起宽 = 0, 拖着 = false;
    function 按下(e) {
      拖着 = true;
      待 = null;
      起X = (e.touches ? e.touches[0] : e).clientX;
      起宽 = 现宽();
      document.body.classList.add("正在拖宽");
      addEventListener("mousemove", 动);
      addEventListener("touchmove", 动, { passive: true });
      addEventListener("mouseup", 松);
      addEventListener("touchend", 松);
      e.preventDefault();
    }
    var 待, 帧 = 0;
    function 动(e) {
      if (!拖着)
        return;
      var x = (e.touches ? e.touches[0] : e).clientX;
      待 = Math.max(小, Math.min(大, 起宽 + (x - 起X)));
      if (帧)
        return;
      帧 = requestAnimationFrame(function() {
        帧 = 0;
        (另设宽 || 设宽)(待);
      });
    }
    function 松(e) {
      if (!拖着)
        return;
      拖着 = false;
      removeEventListener("mousemove", 动);
      removeEventListener("touchmove", 动);
      removeEventListener("mouseup", 松);
      removeEventListener("touchend", 松);
      if (帧) {
        cancelAnimationFrame(帧);
        帧 = 0;
      }
      if (待 != null)
        (另设宽 || 设宽)(待);
      document.body.classList.remove("正在拖宽");
      落(现宽());
      告();
    }
    把手.addEventListener("mousedown", 按下);
    把手.addEventListener("touchstart", 按下, { passive: false });
    把手.tabIndex = 0;
    把手.setAttribute("role", "separator");
    把手.addEventListener("keydown", function(e) {
      var d = e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0;
      if (!d)
        return;
      var px = Math.max(小, Math.min(大, 现宽() + d));
      (另设宽 || 设宽)(px);
      落(px);
      告();
      e.preventDefault();
    });
  }
  function 装跟随() {
    var side = document.getElementById("side");
    if (!side || !window.IntersectionObserver)
      return;
    var 块 = [], 用 = [];
    [].forEach.call(side.querySelectorAll('.side-项[href^="#"]'), function(a) {
      var el = null;
      try {
        el = document.querySelector(a.getAttribute("href"));
      } catch (e) {
        el = null;
      }
      if (el) {
        块.push(el);
        用.push(a);
      }
    });
    if (!块.length)
      return;
    var 顶 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tophd-h")) || 0;
    var 见 = [];
    var ob = new IntersectionObserver(function(es) {
      es.forEach(function(e) {
        var i = 块.indexOf(e.target);
        if (i < 0)
          return;
        var p = 见.indexOf(i);
        if (e.isIntersecting) {
          if (p < 0)
            见.push(i);
        } else if (p >= 0)
          见.splice(p, 1);
      });
      if (!见.length)
        return;
      var 头 = Math.min.apply(Math, 见);
      用.forEach(function(a, i) {
        var 中 = i === 头;
        a.classList.toggle("cur", 中);
        if (中)
          a.setAttribute("aria-current", "location");
        else
          a.removeAttribute("aria-current");
      });
    }, { rootMargin: -(顶 + 8) + "px 0px -70% 0px" });
    块.forEach(function(el) {
      ob.observe(el);
    });
  }
  function 装汉堡(bar) {
    var 钮 = bar && bar.querySelector(".hd-汉堡");
    if (!钮)
      return;
    var 幕 = document.createElement("div");
    幕.className = "side-幕";
    document.body.appendChild(幕);
    function 开(开着) {
      document.body.classList.toggle("侧栏滑出", 开着);
      钮.setAttribute("aria-expanded", 开着 ? "true" : "false");
      var 头 = document.querySelector("#side .side-项");
      if (开着) {
        if (头)
          头.focus();
      } else {
        钮.focus();
      }
    }
    钮.onclick = function() {
      开(!document.body.classList.contains("侧栏滑出"));
    };
    幕.onclick = function() {
      开(false);
    };
    addEventListener("keydown", function(e) {
      if (e.key === "Escape" && document.body.classList.contains("侧栏滑出"))
        开(false);
    });
  }
  function 装详情卡(弹窗, 控制, 放大钮) {
    var 宽线 = window.matchMedia("(min-width:1100px)");
    var 评钮 = document.createElement("button");
    评钮.type = "button";
    评钮.className = "次钮 详情评论钮";
    评钮.title = "放大成整页,在右边看评论、写评论";
    var 待 = 0, 存钮 = null, 存在右 = false, 把 = null;
    function 评论区() {
      return 弹窗.querySelector(".详情-右 [data-评论区]");
    }
    var 存宽 = parseInt(读存(存.详情右宽, ""), 10);
    if (存宽 >= 280 && 存宽 <= 760)
      document.documentElement.style.setProperty("--详情右宽", 存宽 + "px");
    function 正文块() {
      var 右 = 弹窗.querySelector(".详情-右");
      return 右 && 右.parentNode;
    }
    function 正文宽() {
      var 文 = 正文块();
      return 文 ? 文.clientWidth : 0;
    }
    function 右栏宽() {
      var 右 = 弹窗.querySelector(".详情-右");
      return 右 ? 右.getBoundingClientRect().width : 360;
    }
    function 夹右宽(px) {
      var 大 = Math.max(280, Math.min(760, 正文宽() - 420));
      return Math.round(Math.max(280, Math.min(大, px)));
    }
    function 设右宽(px) {
      document.documentElement.style.setProperty("--详情右宽", 夹右宽(px) + "px");
    }
    function 造把手() {
      var h = document.createElement("div");
      h.className = "详情把手";
      h.title = "拖着改宽";
      h.setAttribute("aria-orientation", "vertical");
      拖宽(h, function(左) {
        写存(存.详情右宽, 夹右宽(正文宽() - 左));
      }, function() {
        return 正文宽() - 右栏宽();
      }, function(左) {
        设右宽(正文宽() - 左);
      }, { 小: 1, 大: 99999 });
      return h;
    }
    function 排() {
      var 整页 = 控制.档位() === "整页";
      var 右 = 弹窗.querySelector(".详情-右");
      var 栏 = 放大钮.parentNode;
      var 三栏 = !!(整页 && 右 && 宽线.matches);
      弹窗.classList.toggle("详情三栏", 三栏);
      if (三栏 && 右.parentNode) {
        if (!把)
          把 = 造把手();
        if (把.parentNode !== 右.parentNode)
          右.parentNode.appendChild(把);
        [].forEach.call(弹窗.querySelectorAll(".详情把手"), function(e) {
          if (e !== 把)
            e.parentNode.removeChild(e);
        });
      } else if (把 && 把.parentNode)
        把.parentNode.removeChild(把);
      var 区 = 评论区();
      if (区) {
        if (评钮.parentNode !== 栏 || 评钮.nextSibling !== 放大钮)
          栏.insertBefore(评钮, 放大钮);
        var 字 = "评论 " + (parseInt(区.getAttribute("data-评论数"), 10) || 0);
        if (评钮.textContent !== 字)
          评钮.textContent = 字;
        评钮.hidden = 整页;
      } else if (评钮.parentNode)
        评钮.parentNode.removeChild(评钮);
      var 组 = [].slice.call(弹窗.querySelectorAll(".详情钮"));
      if (组.length > 1) {
        var 新 = 组.filter(function(g) {
          return !(右 && 右.contains(g));
        })[0] || 组[0];
        组.forEach(function(g) {
          if (g !== 新)
            g.parentNode.removeChild(g);
        });
        组 = [新];
      }
      var 钮组 = 组[0] || (存钮 && 存在右 && !存钮.isConnected ? 存钮 : null);
      存钮 = 钮组;
      存在右 = !!(钮组 && 整页 && 右);
      if (!钮组)
        return;
      if (整页 && 右) {
        if (右.firstElementChild !== 钮组)
          右.insertBefore(钮组, 右.firstChild);
      } else {
        var 下个 = 评钮.parentNode === 栏 ? 评钮 : 放大钮;
        if (钮组.parentNode !== 栏 || 钮组.nextSibling !== 下个)
          栏.insertBefore(钮组, 下个);
      }
    }
    评钮.addEventListener("click", function() {
      控制.设档("整页");
      var 区 = 评论区();
      var 框 = 区 && 区.querySelector('textarea, [contenteditable="true"], [contenteditable=""], input[type=text], input:not([type])');
      if (框) {
        框.focus({ preventScroll: true });
        框.scrollIntoView({ block: "nearest" });
      }
    });
    if (宽线.addEventListener)
      宽线.addEventListener("change", 排);
    else
      宽线.addListener(排);
    new MutationObserver(function() {
      if (!待)
        待 = requestAnimationFrame(function() {
          待 = 0;
          排();
        });
    }).observe(弹窗, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-评论数"] });
    return 排;
  }
  function 接弹窗三档(配置) {
    配置 = 配置 || {};
    var 弹窗 = typeof 配置.弹窗 === "string" ? document.querySelector(配置.弹窗) : 配置.弹窗;
    if (!弹窗)
      throw new Error("UI弹窗三档:找不到弹窗");
    if (弹窗.__UI弹窗三档)
      return 弹窗.__UI弹窗三档;
    var 放大钮 = 配置.放大钮 || 弹窗.querySelector(".弹窗放大钮");
    var 关闭钮 = 配置.关闭钮 || 弹窗.querySelector(".弹窗关闭钮");
    if (typeof 放大钮 === "string")
      放大钮 = 弹窗.querySelector(放大钮);
    if (typeof 关闭钮 === "string")
      关闭钮 = 弹窗.querySelector(关闭钮);
    if (!放大钮)
      throw new Error("UI弹窗三档:找不到放大钮");
    var 种类段 = String(配置.种类段 || "").replace(/^\/+|\/+$/g, "");
    var 读网址 = 配置.读网址 || function() {
      return location.hash || "";
    };
    var 写网址 = 配置.写网址 || function(值, 方式) {
      var 地址 = location.pathname + location.search + (值 || "");
      history[方式 === "replace" ? "replaceState" : "pushState"](history.state, "", 地址);
    };
    var 两档 = !!配置.两档;
    var 底档 = 两档 ? "大窗" : "小窗";
    var 档位 = 底档;
    var 原网址 = "";
    var 网址待还原 = false;
    var 排详情 = null;
    function 取数据ID() {
      var 值 = typeof 配置.数据ID === "function" ? 配置.数据ID() : 配置.数据ID;
      return String(值 == null ? "" : 值).trim();
    }
    function 做链接(id) {
      return "#" + 种类段 + "/" + id;
    }
    function 解链接(值) {
      值 = String(值 == null ? "" : 值);
      var 井 = 值.indexOf("#");
      if (井 >= 0)
        值 = 值.slice(井 + 1);
      else
        值 = 值.replace(/^#/, "");
      var 段 = 值.split("/");
      if (段.length !== 2)
        return "";
      try {
        return decodeURIComponent(段[0]) === 种类段 ? decodeURIComponent(段[1]) : "";
      } catch (e) {
        return "";
      }
    }
    function 画钮() {
      var 整页 = 档位 === "整页";
      放大钮.textContent = 整页 ? "⤡" : "⤢";
      放大钮.title = 整页 ? "还原" : "放大";
      放大钮.setAttribute("aria-label", 整页 ? "还原" : "放大");
    }
    function 只换档(新档) {
      档位 = 新档;
      弹窗.classList.remove("弹窗小窗", "弹窗大窗", "弹窗整页");
      弹窗.classList.add(新档 === "整页" ? "弹窗整页" : 新档 === "大窗" ? "弹窗大窗" : "弹窗小窗");
      弹窗.setAttribute("data-弹窗档", 新档);
      画钮();
      if (排详情)
        排详情();
    }
    function 进整页(要写网址) {
      var id = 取数据ID();
      if (要写网址 && id && 种类段) {
        原网址 = String(读网址() || "");
        var 史 = history.state;
        写网址(做链接(id), 史 && 史.UI叠层号 && 史.UI叠层 > 0 ? "replace" : "push");
        网址待还原 = true;
      }
      只换档("整页");
    }
    function 还原() {
      if (网址待还原)
        写网址(原网址, "replace");
      网址待还原 = false;
      只换档(底档);
    }
    function 大窗没更宽() {
      var 宽 = 弹窗.offsetWidth;
      if (!宽)
        return false;
      弹窗.classList.replace("弹窗小窗", "弹窗大窗");
      var 大 = 弹窗.offsetWidth;
      弹窗.classList.replace("弹窗大窗", "弹窗小窗");
      return 大 < 宽 + 100;
    }
    function 下一档() {
      if (档位 === "小窗") {
        if (大窗没更宽())
          进整页(true);
        else
          只换档("大窗");
      } else if (档位 === "大窗")
        进整页(true);
      else
        还原();
    }
    if (弹窗.classList.contains("弹窗整页"))
      档位 = "整页";
    else if (两档 || 弹窗.classList.contains("弹窗大窗"))
      只换档("大窗");
    else
      只换档("小窗");
    画钮();
    放大钮.addEventListener("click", 下一档);
    if (关闭钮)
      关闭钮.addEventListener("click", 还原);
    var 控制 = {
      还原,
      设档: function(新档) {
        if (新档 === "整页")
          进整页(true);
        else if (新档 === "大窗")
          只换档("大窗");
        else
          还原();
      },
      档位: function() {
        return 档位;
      }
    };
    弹窗.__UI弹窗三档 = 控制;
    if (弹窗.classList.contains("详情卡")) {
      排详情 = 装详情卡(弹窗, 控制, 放大钮);
      排详情();
    }
    var 直链ID = 种类段 ? 解链接(读网址()) : "";
    if (直链ID) {
      原网址 = 配置.还原网址 == null ? "" : String(配置.还原网址);
      网址待还原 = true;
      Promise.resolve(配置.按ID打开 ? 配置.按ID打开(直链ID) : null).then(function() {
        只换档("整页");
      });
    }
    return 控制;
  }
  window.UI弹窗三档 = 接弹窗三档;
  接弹窗三档.详情卡 = true;
  var 叠层 = function() {
    var 栈 = [];
    var 碰过 = [];
    var 号 = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var 待目标 = null, 兜底 = 0, 挂了 = false;
    var 史可用 = function() {
      try {
        history.replaceState(history.state, "");
        return true;
      } catch (e) {
        return false;
      }
    }();
    function 取(层) {
      return typeof 层 === "string" ? document.querySelector(层) : 层;
    }
    function 看得见(el) {
      return !!el && el.isConnected && el.getClientRects().length > 0;
    }
    function 是我的(s) {
      return !!s && typeof s === "object" && s.UI叠层号 === 号;
    }
    function 态(深) {
      var 原 = history.state, 新 = {};
      if (原 && typeof 原 === "object")
        for (var k in 原)
          新[k] = 原[k];
      新.UI叠层 = 深;
      新.UI叠层号 = 号;
      return 新;
    }
    function 推(深) {
      if (史可用)
        history.pushState(态(深), "");
    }
    function 退史(步, 目标) {
      if (!史可用 || 步 <= 0) {
        关到(Math.max(目标, 0));
        return;
      }
      待目标 = 目标;
      clearTimeout(兜底);
      兜底 = setTimeout(function() {
        if (待目标 != null) {
          var t = 待目标;
          待目标 = null;
          关到(Math.max(t, 0));
        }
      }, 400);
      history.go(-步);
    }
    function 剪() {
      var n = 0;
      while (栈.length && !看得见(栈[栈.length - 1].层)) {
        栈.pop();
        n++;
      }
      if (n)
        刷钮();
      return n;
    }
    function 关到(深) {
      while (栈.length > 深) {
        var 项 = 栈.pop();
        if (项.换) {
          if (项.回 && 看得见(项.层))
            项.回();
        } else if (项.关 && 看得见(项.层))
          项.关();
      }
      刷钮();
    }
    function 刷钮() {
      碰过 = 碰过.filter(function(el) {
        return el.isConnected;
      });
      碰过.forEach(function(el) {
        var i = -1;
        栈.forEach(function(项, j) {
          if (项.层 === el)
            i = j;
        });
        var 钮 = el.__UI叠层钮;
        if (!钮)
          return;
        if (i >= 1) {
          var 名 = 栈[i - 1].名;
          钮.textContent = "← 返回" + (名 || "上一层");
          钮.title = 钮.textContent.slice(2);
          钮.hidden = false;
        } else
          钮.hidden = true;
      });
    }
    function 装钮(项, 设) {
      var el = 项.层;
      if (!el.__UI叠层钮 && !设.无返回钮) {
        var 钮 = document.createElement("button");
        钮.type = "button";
        钮.className = "叠层返回";
        钮.hidden = true;
        钮.addEventListener("click", function(e) {
          e.preventDefault();
          退();
        });
        var 位 = 设.钮位 && el.querySelector(设.钮位) || el.querySelector(".弹窗标题栏") || el;
        位.insertBefore(钮, 位.firstChild);
        el.__UI叠层钮 = 钮;
        碰过.push(el);
      }
      if (设.叉全关 !== false && !el.__UI叠层叉) {
        var 叉 = 取(设.关闭钮) || el.querySelector(".弹窗关闭钮");
        if (叉) {
          叉.addEventListener("click", function() {
            if (栈.some(function(x) {
              return x.层 === el;
            }))
              全关();
          });
          el.__UI叠层叉 = 1;
        }
      }
    }
    function 有别的浮层() {
      var 框 = document.querySelectorAll("dialog[open]");
      for (var i = 0;i < 框.length; i++) {
        var d = 框[i];
        if (!栈.some(function(x) {
          return x.层 === d || x.层.contains(d) || d.contains(x.层);
        }))
          return true;
      }
      return document.body.classList.contains("侧栏滑出");
    }
    function 对齐() {
      var n = 剪();
      if (n)
        退史(n, 栈.length);
      return n;
    }
    function 挂() {
      if (挂了)
        return;
      挂了 = true;
      addEventListener("popstate", function(e) {
        var s = e.state;
        if (!是我的(s)) {
          if (待目标 != null) {
            var t = 待目标;
            待目标 = null;
            关到(Math.max(t, 0));
          }
          return;
        }
        var 深 = s.UI叠层;
        if (剪() && 待目标 == null)
          待目标 = 栈.length - 1;
        if (待目标 != null && 深 > 待目标) {
          history.back();
          return;
        }
        待目标 = null;
        clearTimeout(兜底);
        关到(深);
        if (深 > 栈.length && 史可用)
          history.replaceState(态(栈.length), "");
      });
      addEventListener("keydown", function(e) {
        if (e.key !== "Escape" || e.isComposing || !栈.length)
          return;
        if (对齐()) {
          e.preventDefault();
          return;
        }
        if (e.defaultPrevented || 有别的浮层())
          return;
        e.preventDefault();
        退();
      });
      function 稍后对齐() {
        if (栈.length)
          setTimeout(function() {
            if (待目标 == null)
              对齐();
          }, 0);
      }
      document.addEventListener("click", 稍后对齐, true);
      document.addEventListener("keyup", 稍后对齐, true);
    }
    function 加(层, 设, 换) {
      挂();
      var 剪数 = 剪();
      if (换 && (!栈.length || 栈[栈.length - 1].层 !== 层))
        throw new Error("UI叠层.换:这一层还没压(先 UI叠层.压)");
      if (!栈.length && !剪数 && 史可用)
        history.replaceState(态(0), "");
      栈.push({ 层, 名: String(设.名 == null ? "" : 设.名).trim(), 关: 设.关, 回: 设.回, 换: !!换 });
      装钮(栈[栈.length - 1], 设);
      if (剪数) {
        if (史可用)
          history.replaceState(态(栈.length), "");
      } else
        推(栈.length);
      刷钮();
      return 栈.length;
    }
    function 压(层, 设) {
      层 = 取(层);
      if (!层)
        throw new Error("UI叠层.压:找不到这一层");
      return 加(层, 设 || {}, false);
    }
    function 换(层, 设) {
      层 = 取(层);
      if (!层)
        throw new Error("UI叠层.换:找不到这一层");
      return 加(层, 设 || {}, true);
    }
    function 退() {
      var n = 剪();
      if (!栈.length) {
        if (n)
          退史(n, 0);
        return;
      }
      退史(n + 1, 栈.length - 1);
    }
    function 全关() {
      var 剪数 = 剪(), n = 栈.length;
      if (!n && !剪数)
        return;
      while (栈.length) {
        var 项 = 栈.pop();
        if (!项.换 && 项.关 && 看得见(项.层))
          项.关();
      }
      刷钮();
      退史(n + 剪数, 0);
    }
    return {
      压,
      换,
      退,
      全关,
      深度: function() {
        return 栈.length;
      },
      顶: function() {
        for (var i = 栈.length - 1;i >= 0; i--)
          if (看得见(栈[i].层))
            return 栈[i].层;
        return null;
      }
    };
  }();
  window.UI叠层 = 叠层;
  window.UI布局 = {
    装: function(配置) {
      配置 = 改公网(配置 || {});
      if (document.getElementById("tophd"))
        return;
      var 嵌着 = false;
      try {
        嵌着 = window.self !== window.top;
      } catch (e) {
        嵌着 = true;
      }
      if (嵌着 || /[?&]embed=1\b/.test(location.search))
        return;
      var 记 = 读存("ui:主题", "");
      if (记)
        document.documentElement.setAttribute("data-theme", 记);
      if (配置.内层先列)
        document.body.classList.add("内层先列");
      if (配置.宽档 === "读") {
        var w = document.querySelector(".wrap");
        if (w)
          w.classList.add("读");
      }
      var bar = 建顶栏(配置);
      if (有侧栏(配置)) {
        建侧栏(配置);
        装汉堡(bar);
        装跟随();
      }
      if (配置.内层)
        装内层(配置);
    },
    收放,
    设宽,
    _拖宽: 拖宽,
    址: 公网址
  };
})();
(function() {
  if (window.UI模型牌)
    return;
  var 关档 = "关";
  var 当前 = null;
  function 建(标签, 类, 字) {
    var e = document.createElement(标签);
    if (类)
      e.className = 类;
    if (字 != null)
      e.textContent = 字;
    return e;
  }
  function 牌字(r) {
    var s = (r.供应商 || "?") + " / " + (r.模型 || "?");
    if (r.推理强度 && r.推理强度 !== 关档)
      s += " · " + r.推理强度;
    return s;
  }
  function 时刻() {
    var d = new Date, z = -d.getTimezoneOffset();
    return d.toLocaleString("zh-CN", { hour12: false }) + " UTC" + (z < 0 ? "-" : "+") + Math.abs(z / 60) + (z % 60 ? ":" + ("0" + Math.abs(z % 60)).slice(-2) : "");
  }
  function 复制钮(整段) {
    var 钮 = 建("button", "模型牌-钮", "⧉ 复制报错");
    钮.type = "button";
    钮.addEventListener("click", function(e) {
      e.stopPropagation();
      var 字 = 整段();
      var 成 = function() {
        钮.textContent = "✓ 已复制";
      };
      var 退 = function() {
        var t = 建("textarea");
        t.value = 字;
        t.setAttribute("readonly", "");
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        try {
          if (document.execCommand("copy"))
            成();
          else
            钮.replaceChildren(建("i", "符 坏", "✗"), "没复制上");
        } catch (er) {
          钮.replaceChildren(建("i", "符 坏", "✗"), "没复制上");
        }
        t.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(字).then(成, 退);
      else
        退();
    });
    return 钮;
  }
  function 报错段(人话, 原文, 位置, 错误号, 时间) {
    return [
      人话,
      "原始报错:" + (原文 || "(空)"),
      "位置:" + 位置,
      "时间:" + (时间 || 时刻()),
      "错误号:" + (错误号 || "无")
    ].join(`
`);
  }
  function 取(网址, 体) {
    var 参 = { headers: { Accept: "application/json" } };
    if (体) {
      参.method = "POST";
      参.headers["Content-Type"] = "application/json";
      参.body = JSON.stringify(体);
    }
    return fetch(网址, 参).then(function(r) {
      return r.text().then(function(t) {
        var j = null;
        try {
          j = JSON.parse(t);
        } catch (e) {}
        if (!r.ok || !j) {
          var er = new Error(j && j.错 || t || "HTTP " + r.status);
          er.状态 = r.status;
          throw er;
        }
        return j;
      });
    });
  }
  function 关浮层() {
    if (!当前)
      return;
    var 锚 = 当前.锚;
    当前.层.remove();
    document.removeEventListener("mousedown", 点外面, true);
    document.removeEventListener("keydown", 按键, true);
    window.removeEventListener("resize", 关浮层);
    当前 = null;
    if (锚 && 锚.isConnected)
      锚.focus();
  }
  function 点外面(e) {
    if (当前 && !当前.层.contains(e.target) && e.target !== 当前.锚)
      关浮层();
  }
  function 按键(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      关浮层();
    }
  }
  function 摆(层, 锚) {
    var r = 锚.getBoundingClientRect(), 宽 = 层.offsetWidth, 高 = 层.offsetHeight;
    var 左 = Math.max(16, Math.min(r.left, window.innerWidth - 宽 - 16));
    var 上 = r.bottom + 6;
    if (上 + 高 > window.innerHeight - 16)
      上 = Math.max(16, r.top - 高 - 6);
    层.style.left = 左 + "px";
    层.style.top = 上 + "px";
  }
  function 开浮层(功能名, 锚, 配) {
    配 = 配 || {};
    var 族口 = 配.族口 || "/api/model-badge/family";
    var 挪口 = 配.挪口 || "/api/model-badge/move";
    var 底座网址 = 配.底座网址 || location.protocol + "//" + location.hostname + ":8791/";
    if (window.UI布局 && window.UI布局.址)
      底座网址 = window.UI布局.址(底座网址);
    关浮层();
    var 层 = 建("div", "模型浮层");
    层.setAttribute("role", "dialog");
    层.setAttribute("aria-label", 功能名 + " · 先试谁");
    var 体 = 建("div", null, "正在读底座…");
    var 错位 = 建("div");
    var 去 = 建("a", "去", "去底座改更多 ↗");
    去.href = 底座网址;
    去.target = "_blank";
    去.rel = "noopener";
    层.append(建("h4", null, 功能名 + " · 先试谁"), 体, 错位, 建("div", "注", "挪完从下一次调用起生效"), 去);
    document.body.appendChild(层);
    当前 = { 层, 锚 };
    摆(层, 锚);
    document.addEventListener("mousedown", 点外面, true);
    document.addEventListener("keydown", 按键, true);
    window.addEventListener("resize", 关浮层);
    function 显错(人话, er, 位置, 先) {
      错位.replaceChildren();
      var 条 = 建("div", "错");
      条.setAttribute("role", "alert");
      条.append(建("span", null, 人话), 复制钮(function() {
        var 段 = 报错段(人话, er && er.message, 位置, er && er.状态 ? "HTTP " + er.状态 : "");
        if (先)
          段 += `
── 在这之前 ──
` + 报错段(先.人话, 先.er && 先.er.message, 先.位置, 先.er && 先.er.状态 ? "HTTP " + 先.er.状态 : "");
        return 段;
      }));
      if (先) {
        var 再 = 建("button", "mini", "重新读取");
        再.type = "button";
        再.addEventListener("click", function() {
          再.disabled = true;
          重读().then(function() {
            错位.replaceChildren();
            摆(层, 锚);
          }, function(er2) {
            显错(人话, er2, 位置, 先);
          });
        });
        条.append(再);
      }
      错位.append(条);
      摆(层, 锚);
    }
    function 重读() {
      return 取(族口 + "?功能名=" + encodeURIComponent(功能名)).then(function(j) {
        画表(j.行们 || []);
      });
    }
    function 画表(行们, 聚焦名, 聚焦向) {
      var 表 = 建("table"), tb = 建("tbody");
      var 末 = 行们.length - 1;
      行们.forEach(function(r, i) {
        var tr = 建("tr", i === 0 ? "首" : "");
        if (r.启用 === false) {
          tr.classList.add("停");
          tr.title = "这一行停用了,轮到它会跳过";
        }
        var 钮格 = 建("td");
        [["上", "↑", i === 0], ["下", "↓", i === 末]].forEach(function(x) {
          var b = 建("button", "挪", x[1]);
          b.type = "button";
          b.disabled = x[2];
          b.dataset.名 = r.功能名;
          b.dataset.向 = x[0];
          b.setAttribute("aria-label", (i === 0 ? "首选" : "备选 " + i) + " 往" + x[0] + "挪一格");
          b.addEventListener("click", function() {
            挪(r.功能名, x[0]);
          });
          钮格.append(b);
        });
        tr.append(建("td", null, i === 0 ? "首选" : "备选 " + i), 建("td", null, r.供应商 || "?"), 建("td", "模型", r.模型 || "?"), 建("td", null, r.推理强度 && r.推理强度 !== 关档 ? r.推理强度 : "—"), 钮格);
        tb.append(tr);
      });
      表.append(tb);
      体.replaceChildren(表);
      摆(层, 锚);
      if (聚焦名) {
        var 同行 = Array.prototype.filter.call(层.querySelectorAll(".挪"), function(b) {
          return b.dataset.名 === 聚焦名;
        });
        var b = 同行.filter(function(b) {
          return b.dataset.向 === 聚焦向 && !b.disabled;
        })[0] || 同行.filter(function(b) {
          return !b.disabled;
        })[0];
        if (b)
          b.focus();
      } else {
        var 首钮 = 层.querySelector(".挪:not(:disabled)");
        if (首钮)
          首钮.focus();
      }
    }
    function 挪(行名, 向) {
      错位.replaceChildren();
      层.querySelectorAll(".挪").forEach(function(b) {
        b.disabled = true;
      });
      取(挪口, { 功能名: 行名, 方向: 向 }).then(function(j) {
        var 行们 = j.行们 || [];
        var 现名 = j.这一行 || 行名;
        var i = 行们.findIndex(function(r) {
          return r.功能名 === 现名;
        });
        var 到 = 行们[向 === "上" ? i - 1 : i + 1];
        画表(行们, 到 ? 到.功能名 : null, 向);
      }).catch(function(er) {
        var 挪错 = { 人话: "没挪成,点复制把报错发给 AI 看", er, 位置: "换首选 · " + 行名 + " 往" + 向 + " · " + 挪口 };
        显错(挪错.人话, 挪错.er, 挪错.位置);
        重读().catch(function(er2) {
          显错("顺序没读回来,点重新读取", er2, "换首选 · 补读 · " + 族口 + " · " + 功能名, 挪错);
        });
      });
    }
    重读().catch(function(er) {
      体.replaceChildren();
      显错("读不到先后顺序,先去底座改", er, "换首选 · " + 族口 + " · " + 功能名);
    });
  }
  function 画(回执, 配) {
    if (!回执 || !回执.功能名)
      return null;
    配 = 配 || {};
    var 组 = 建("span", "模型牌组");
    var 换过 = !!回执.换过备选;
    var 牌 = 建("span", "tag t灰 模型牌" + (换过 ? " 换过" : ""), (换过 ? "⚠ 已换备选 · " : "") + 牌字(回执));
    var 试过 = (回执.试过 || []).join(" → ");
    牌.title = 换过 ? "首选没成,底座自动换了「" + 回执.实际那一行 + `」答的
首选错误:` + (回执.首选错误 || "(空)") + `
试过:` + 试过 : "这次由「" + (回执.实际那一行 || 回执.功能名) + "」答的";
    组.append(牌);
    if (换过) {
      var 因 = null;
      牌.setAttribute("role", "button");
      牌.tabIndex = 0;
      牌.setAttribute("aria-expanded", "false");
      var 切 = function() {
        if (因) {
          因.remove();
          因 = null;
          牌.setAttribute("aria-expanded", "false");
          return;
        }
        因 = 建("span", "模型牌-因");
        因.append(建("i", "符 提", "⚠"), 建("span", null, "首选没成,这次换了备选答"), 复制钮(function() {
          return 报错段("首选没成,底座自动换了备选答", 回执.首选错误, "底座功能「" + 回执.功能名 + "」→ 实际「" + 回执.实际那一行 + "」;试过 " + 试过, "");
        }));
        组.append(因);
        牌.setAttribute("aria-expanded", "true");
      };
      牌.addEventListener("click", 切);
      牌.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          切();
        }
      });
    }
    if (!配.不要换钮) {
      var 钮 = 建("button", "模型牌-钮", "⇅ 换首选");
      钮.type = "button";
      钮.title = "调整「" + 回执.功能名 + "」先试哪个模型,改的是底座那一份";
      钮.setAttribute("aria-haspopup", "dialog");
      钮.addEventListener("click", function() {
        if (当前 && 当前.锚 === 钮) {
          关浮层();
          return;
        }
        开浮层(回执.功能名, 钮, 配);
      });
      组.insertBefore(钮, 牌.nextSibling);
    }
    return 组;
  }
  window.UI模型牌 = { 画, 开: 开浮层, 关: 关浮层 };
})();
(function() {
  if (window.UI调用)
    return;
  var 关档 = "关";
  function 建(标签, 类, 字) {
    var e = document.createElement(标签);
    if (类)
      e.className = 类;
    if (字 != null)
      e.textContent = 字;
    return e;
  }
  function 时刻() {
    var d = new Date, z = -d.getTimezoneOffset();
    return d.toLocaleString("zh-CN", { hour12: false }) + " UTC" + (z < 0 ? "-" : "+") + Math.abs(z / 60) + (z % 60 ? ":" + ("0" + Math.abs(z % 60)).slice(-2) : "");
  }
  function 复制钮(整段) {
    var 钮 = 建("button", "调用-复制", "⧉ 复制报错");
    钮.type = "button";
    钮.addEventListener("click", function(e) {
      e.stopPropagation();
      var 字 = 整段();
      var 成 = function() {
        钮.textContent = "✓ 已复制";
      };
      var 退 = function() {
        var t = 建("textarea");
        t.value = 字;
        t.setAttribute("readonly", "");
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        try {
          if (document.execCommand("copy"))
            成();
          else
            钮.replaceChildren(建("i", "符 坏", "✗"), "没复制上");
        } catch (er) {
          钮.replaceChildren(建("i", "符 坏", "✗"), "没复制上");
        }
        t.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(字).then(成, 退);
      else
        退();
    });
    return 钮;
  }
  function 报错段(人话, 原文, 位置, 错误号, 时间) {
    return [
      人话,
      "原始报错:" + (原文 || "(空)"),
      "位置:" + 位置,
      "时间:" + (时间 || 时刻()),
      "错误号:" + (错误号 || "无")
    ].join(`
`);
  }
  function 取(网址) {
    return fetch(网址, { headers: { Accept: "application/json" } }).then(function(r) {
      return r.text().then(function(t) {
        var j = null;
        try {
          j = JSON.parse(t);
        } catch (e) {}
        if (!r.ok || !j) {
          var er = new Error(j && j.错 || t || "HTTP " + r.status);
          er.状态 = r.status;
          throw er;
        }
        return j;
      });
    });
  }
  function 带名(口, 功能名) {
    return 口 + (口.indexOf("?") < 0 ? "?" : "&") + "功能名=" + encodeURIComponent(功能名);
  }
  function 谁(供应商, 模型, 强度) {
    var s = (供应商 === false ? "" : (供应商 || "?") + " / ") + (模型 || "?");
    if (强度 && 强度 !== 关档)
      s += " · " + 强度;
    return s;
  }
  function 跑(钮, 配, 干) {
    配 = 配 || {};
    var 动作 = 配.动作 || (钮.textContent || "").trim() || "调用";
    var 按 = !配.不按钮;
    if (按 && 钮.disabled)
      return Promise.reject(new Error("上一次还没回来"));
    if (钮._调用计时)
      clearInterval(钮._调用计时);
    var 行 = 钮._调用等;
    if (!行 || !行.isConnected) {
      行 = 建("span", "调用-等");
      行.setAttribute("role", "status");
      if (配.行位)
        配.行位.appendChild(行);
      else
        钮.insertAdjacentElement("afterend", 行);
      钮._调用等 = 行;
    }
    行.className = "调用-等";
    行.title = "";
    var 起 = Date.now(), 答者 = "";
    var 秒 = 建("span", "秒", "0");
    var 答位 = 建("span");
    行.replaceChildren("⟳ 正在" + 动作 + " · 已等 ", 秒, " 秒", 答位);
    if (按) {
      钮.disabled = true;
      钮.setAttribute("aria-busy", "true");
    }
    var 平常 = 60, 慢了 = false, 弃了 = false, 放手 = null;
    钮._调用计时 = setInterval(function() {
      var 已 = Math.floor((Date.now() - 起) / 1000);
      秒.textContent = String(已);
      if (!慢了 && 已 > 平常 * 2)
        变慢();
    }, 1000);
    function 变慢() {
      慢了 = true;
      行.className = "调用-等 慢";
      行.title = 慢说(平常, "次");
      行.replaceChildren("⚠ 比平常慢,已等 ", 秒, " 秒", 钮_("小钮", "不等了", function() {
        if (弃了)
          return;
        弃了 = true;
        var 已 = 收();
        行.className = "调用-等 弃";
        行.title = "";
        行.textContent = 弃字;
        if (按 && 钮.isConnected)
          钮.focus();
        放手(不等错(已, 平常));
      }));
    }
    if (配.功能名) {
      try {
        读平常(配.史口, 配.功能名).then(function(s) {
          平常 = s;
        }, function() {});
      } catch (er) {}
      取(带名(配.族口 || "/api/model-badge/family", 配.功能名)).then(function(j) {
        var 首 = (j.行们 || []).filter(function(r) {
          return r.启用 !== false && r.启用 !== 0;
        })[0];
        if (首 && 钮._调用计时) {
          答者 = 谁(首.供应商, 首.模型, 首.推理强度);
          答位.textContent = " · 谁在答:" + 答者;
        }
      }, function() {});
    }
    function 收() {
      clearInterval(钮._调用计时);
      钮._调用计时 = null;
      if (按) {
        钮.disabled = false;
        钮.removeAttribute("aria-busy");
      }
      return ((Date.now() - 起) / 1000).toFixed(0);
    }
    var 承;
    try {
      承 = Promise.resolve(干());
    } catch (er) {
      承 = Promise.reject(er);
    }
    var 弃承 = new Promise(function(_, 拒) {
      放手 = 拒;
    });
    function 刷史() {
      if (配.历史 && 配.历史.刷新)
        配.历史.刷新();
    }
    var 果 = 承.then(function(j) {
      if (弃了) {
        刷史();
        return j;
      }
      var 用 = 收(), 执 = j && j.回执;
      if (执 && (执.供应商 || 执.模型)) {
        var 名 = 谁(执.供应商, 执.模型, 执.推理强度);
        if (执.换过备选) {
          行.className = "调用-等 换";
          行.textContent = "⚠ 首选没接,换了 " + 名 + " 答 · 用了 " + 用 + " 秒";
          行.title = "首选错误:" + (执.首选错误 || "(空)") + `
试过:` + (执.试过 || []).join(" → ");
        } else {
          行.className = "调用-等 完";
          行.textContent = "用了 " + 用 + " 秒 · " + 名 + " 答的";
          行.title = "";
        }
      } else {
        行.className = "调用-等 完";
        行.textContent = "用了 " + 用 + " 秒";
        行.title = "";
      }
      if (配.历史 && 配.历史.刷新)
        配.历史.刷新();
      return j;
    }, function(er) {
      if (弃了) {
        刷史();
        return;
      }
      var 用 = 收(), 人话 = 动作 + "没成,点复制把报错发给 AI 看";
      行.className = "调用-等 败";
      行.title = "";
      行.replaceChildren(建("span", null, "✗ " + 人话), 复制钮(function() {
        return 报错段(人话, er && er.message, (配.位置 || location.pathname) + " · " + 动作 + " · 等了 " + 用 + " 秒", er && er.状态 ? "HTTP " + er.状态 : "");
      }));
      if (配.历史 && 配.历史.刷新)
        配.历史.刷新();
      throw er;
    });
    return Promise.race([果, 弃承]);
  }
  function 读平常(史口, 功能名) {
    return 取(带名(史口 || "/api/model-badge/history", 功能名)).then(function(j) {
      var 成们 = (j.日志 || []).filter(function(r) {
        return r.成没成 && r.耗时毫秒 > 0;
      }).slice(0, 10);
      if (!成们.length)
        return 60;
      return 成们.reduce(function(和, r) {
        return 和 + r.耗时毫秒;
      }, 0) / 成们.length / 1000;
    });
  }
  function 读记(键) {
    try {
      return localStorage.getItem(键) === "开";
    } catch (e) {
      return false;
    }
  }
  function 写记(键, 开) {
    try {
      if (开)
        localStorage.setItem(键, "开");
      else
        localStorage.removeItem(键);
    } catch (e) {}
  }
  function 历史(容器, 配) {
    配 = 配 || {};
    var 网址 = 配.网址 || 带名(配.史口 || "/api/model-badge/history", 配.功能名 || "");
    var 记键 = "UI调用史:" + 网址;
    var 壳 = 建("div", "调用史");
    var 头 = 建("button", "调用史-头");
    头.type = "button";
    var 身 = 建("div", "调用史-身");
    身.hidden = true;
    壳.append(头, 身);
    (容器 || document.body).appendChild(壳);
    var 开 = 读记(记键), 头字 = "正在读…";
    function 画头() {
      头.textContent = (开 ? "▾ " : "▸ ") + (配.标题 || "调用历史") + " · " + 头字;
      头.setAttribute("aria-expanded", 开 ? "true" : "false");
      身.hidden = !开;
    }
    function 画表(j) {
      var 志 = j.日志 || [];
      if (!志.length) {
        身.replaceChildren(建("div", "调用史-空", "还没点过"));
        return;
      }
      var 表 = 建("table", "调用史-表"), 头行 = 建("tr");
      ["时刻", "用了谁", "模型", "成没成", "耗时", "报错"].forEach(function(s) {
        头行.append(建("th", null, s));
      });
      表.append(建("thead"), 建("tbody"));
      表.tHead.append(头行);
      志.forEach(function(r) {
        var tr = 建("tr");
        var 刻 = String(r.时刻 || "");
        var 格 = 建("td", r.成没成 ? "成" : "败");
        格.append(建("i", r.成没成 ? "符 好" : "符 坏", r.成没成 ? "✓" : "✗"), r.成没成 ? "成" : "没成");
        tr.append(建("td", null, 刻.length >= 16 ? 刻.slice(5, 16) : 刻), 建("td", null, r.用了谁 || "—"), 建("td", null, r.模型 || "—"), 格, 建("td", null, r.耗时毫秒 == null ? "—" : (r.耗时毫秒 / 1000).toFixed(1) + " 秒"));
        var 错格 = 建("td");
        if (!r.成没成 && r.报错原文) {
          var 看 = 建("span", "调用史-看", "⚠ 看报错");
          看.title = r.报错原文;
          错格.append(看, " ", 复制钮(function() {
            return 报错段("这一回没成", r.报错原文, (r.功能 || "") + " · " + (r.用了谁 || "") + " / " + (r.模型 || ""), "", r.时刻);
          }));
        }
        tr.append(错格);
        表.tBodies[0].append(tr);
      });
      var 框 = 建("div", "调用史-框");
      框.append(表);
      身.replaceChildren(框);
    }
    var 序 = 0;
    function 刷新() {
      var 我 = ++序;
      return 取(网址).then(function(j) {
        if (我 !== 序)
          return;
        头字 = j.调了 ? "点过 " + j.调了 + " 回、成了 " + (j.成了 || 0) + " 回" : "还没点过";
        画表(j);
        画头();
      }, function(er) {
        if (我 !== 序)
          return;
        var 人话 = "历史没读到,点复制把报错发给 AI 看";
        头字 = "没读到";
        var 条 = 建("div", "调用-等 败");
        条.setAttribute("role", "alert");
        条.append(建("span", null, "✗ " + 人话), 复制钮(function() {
          return 报错段(人话, er && er.message, 网址, er && er.状态 ? "HTTP " + er.状态 : "");
        }));
        身.replaceChildren(条);
        画头();
      });
    }
    头.addEventListener("click", function() {
      开 = !开;
      写记(记键, 开);
      画头();
    });
    画头();
    刷新();
    return { 刷新, 壳 };
  }
  function 钮_(类, 字, 点) {
    var b = 建("button", 类, 字);
    b.type = "button";
    b.addEventListener("click", 点);
    return b;
  }
  function 错段(人话, er, 位置) {
    return 报错段(人话, er && er.message, 位置, er && er.状态 ? "HTTP " + er.状态 : "");
  }
  function 错行(标签, 类, 人话, 段) {
    var e = 建(标签, 类), 话 = 建("span");
    话.append(建("i", "符 坏", "✗"), 人话);
    e.append(话, 复制钮(段));
    return e;
  }
  var 弃字 = "没等它,底座那次照样跑完、照样扣";
  function 慢说(平常, 那) {
    return "平常 = 这个功能最近 10 回成了的平均耗时,约 " + Math.round(平常) + " 秒;「不等了」只是页面不等,底座那" + 那 + "照样跑完、照样扣";
  }
  function 不等错(已, 平常) {
    var er = new Error("页面不等了:已等 " + 已 + " 秒,平常约 " + Math.round(平常) + " 秒");
    er.不等了 = true;
    return er;
  }
  function 属(e, o) {
    for (var k in o)
      e.setAttribute(k, o[k]);
    return e;
  }
  function 址(u) {
    return window.UI布局 && window.UI布局.址 ? window.UI布局.址(u) : u;
  }
  window.UI调用 = { 跑, 历史, 平常: 读平常, _件: {
    建,
    钮: 钮_,
    复制钮,
    报错段,
    错段,
    错行,
    取,
    带名,
    谁,
    址,
    属,
    弃字,
    慢说,
    不等错
  } };
})();
(function() {
  if (window.UI快搜)
    return;
  window.UI快搜 = true;
  function 同步(框) {
    var 壳 = 框.closest && 框.closest(".快搜");
    var 清 = 壳 && 壳.querySelector(".快搜-清");
    if (清)
      清.hidden = !框.value;
  }
  document.addEventListener("input", function(e) {
    if (e.target.matches && e.target.matches(".快搜 input"))
      同步(e.target);
  }, true);
  document.addEventListener("click", function(e) {
    var 清 = e.target.closest && e.target.closest(".快搜-清");
    if (!清)
      return;
    var 框 = 清.closest(".快搜").querySelector("input");
    if (!框)
      return;
    框.value = "";
    框.dispatchEvent(new Event("input", { bubbles: true }));
    框.focus();
  });
  document.addEventListener("keydown", function(e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey)
      return;
    var 在 = document.activeElement;
    if (在 && (在.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(在.tagName)))
      return;
    var 顶 = document.querySelector(".确认幕") || window.UI叠层 && window.UI叠层.顶 && window.UI叠层.顶();
    if (!顶)
      try {
        顶 = document.querySelector("dialog:modal");
      } catch (x) {}
    var 框们 = (顶 || document).querySelectorAll(".快搜 input");
    for (var i = 0;i < 框们.length; i++) {
      if (框们[i].offsetParent !== null) {
        e.preventDefault();
        框们[i].focus();
        框们[i].select();
        return;
      }
    }
  });
  function 全同步() {
    if (document.querySelectorAll)
      Array.prototype.forEach.call(document.querySelectorAll(".快搜 input"), 同步);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", 全同步);
  else
    全同步();
})();
(function() {
  if (window.UI长活 || !window.UI调用 || !window.UI调用._件)
    return;
  var 件 = window.UI调用._件, 建 = 件.建;
  function 空() {}
  function 投(网址, 体) {
    return fetch(网址, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(体) }).then(function(r) {
      return r.text().then(function(t) {
        var j = null;
        try {
          j = JSON.parse(t);
        } catch (e) {}
        if (!r.ok || !j) {
          var er = new Error(j && j.错 || t || "HTTP " + r.status);
          er.状态 = r.status;
          throw er;
        }
        return j;
      });
    });
  }
  function 族(配) {
    return Promise.resolve().then(function() {
      return 件.取(件.带名(配.族口 || "/api/model-badge/family", 配.功能名 || ""));
    });
  }
  function 停用(r) {
    return r.启用 === false || r.启用 === 0;
  }
  function 牌字(r) {
    return 件.谁(r.供应商, r.模型, r.推理强度);
  }
  function 跑(块, 配) {
    配 = 配 || {};
    var 动作 = 配.动作 || "批量跑", 做一条 = 配.做一条;
    if (typeof 做一条 !== "function")
      return Promise.reject(new Error("UI长活.跑 少了 做一条"));
    if (块._长活 && 块._长活.在跑中)
      return Promise.reject(new Error("上一批还没跑完"));
    function 名之(条, 号) {
      if (typeof 配.条名 === "function")
        return String(配.条名(条, 号));
      if (条 == null || typeof 条 !== "object")
        return String(条);
      return String(条.名 || 条.编号 || 条.id || "第 " + (号 + 1) + " 条");
    }
    var 队 = Array.prototype.slice.call(配.条们 || []).map(function(条, 号) {
      return { 条, 号 };
    });
    var 共 = 队.length, 在跑们 = [], 成们 = [], 败们 = [], 撤们 = [], 停了 = false;
    var 藏同时 = 配.同时 === false;
    var 同时 = Math.max(1, Math.floor(Number(配.同时)) || 1), 同时来自底座 = false, 平常 = 60;
    var 位置 = (配.位置 || location.pathname) + " · " + 动作;
    if (块._长活 && 块._长活.壳.isConnected)
      块._长活.壳.remove();
    var 壳 = 建("div", "长活"), 头 = 建("div", "长活-头"), 数 = 建("div", "长活-数");
    var 首位 = 建("span"), 跑位 = 建("span"), 成位 = 建("b", "成"), 共位 = 建("span");
    var 败钮 = 件.钮("长活-败钮", "", function() {
      败单.hidden = !败单.hidden;
      败钮.setAttribute("aria-expanded", String(!败单.hidden));
    });
    败钮.setAttribute("aria-expanded", "false");
    var 同时位 = 建("span"), 同时字 = 建("span", "长活-同时");
    同时位.append(" · ", 同时字);
    同时位.hidden = 藏同时;
    数.append(首位, 跑位, 成位, " · ", 败钮, 共位, 同时位);
    var 停钮 = 件.钮("次钮", "■ 停止", 停);
    停钮.title = "排队的当场撤掉、不扣钱;在跑的跑完为止(已经发出去的照样扣)";
    头.append(数, 停钮);
    var 槽 = 建("div", "长活-槽"), 进 = 建("i");
    件.属(槽, { role: "progressbar", "aria-label": 动作 + "进度", "aria-valuemin": 0, "aria-valuemax": 共 });
    槽.append(进);
    var 慢行 = 建("div", "长活-慢"), 慢字 = 建("span");
    慢行.append(慢字, 件.钮("小钮", "不等了", 不等));
    var 注 = 建("div", "长活-注"), 败单 = 建("ul", "长活-败单");
    注.setAttribute("role", "status");
    慢行.hidden = 注.hidden = 败单.hidden = true;
    壳.append(头, 槽, 慢行, 注, 败单);
    块.appendChild(壳);
    var 态 = 块._长活 = { 壳, 在跑中: true };
    function 画() {
      var 完 = 成们.length + 败们.length;
      if (态.在跑中) {
        if (停了)
          首位.replaceChildren("■ 停止中 · ");
        else
          首位.replaceChildren(建("i", "符 转", "⟳"), " ");
        跑位.textContent = "在跑 " + 在跑们.length + " · 排队 " + 队.length + " · ";
      } else {
        首位.replaceChildren(停了 ? "■ 已停止 · " : "已" + 动作 + " · ");
        跑位.textContent = "";
      }
      成位.textContent = "✓ " + 成们.length;
      败钮.textContent = "✗ " + 败们.length;
      败钮.disabled = !败们.length;
      败钮.title = 败们.length ? "点开看没成的那几条" : "";
      共位.textContent = " · 共 " + 共;
      同时字.textContent = "同时 " + 同时 + " 个";
      同时字.title = 同时来自底座 ? "同时跑几个在 AI 底座改(只存底座一处)" : "底座还没给这个数,先按页面自己的 " + 同时 + " 个跑;要设去 AI 底座";
      同时位.hidden = 藏同时 || 停了 && !态.在跑中;
      进.style.width = (共 ? 完 / 共 * 100 : 100) + "%";
      槽.setAttribute("aria-valuenow", String(完));
    }
    function 记败(项, er, 没等) {
      var 名 = 名之(项.条, 项.号), 等了 = Math.round((Date.now() - 项.起) / 1000);
      var 人话 = 名 + " · " + (没等 ? 件.弃字 : 动作 + "没成,点复制把报错发给 AI 看");
      败们.push({ 条: 项.条, 错: er });
      败单.append(件.错行("li", 没等 ? "弃" : "", 人话, function() {
        return 件.错段(人话, er, 位置 + " · " + 名 + " · 等了 " + 等了 + " 秒");
      }));
    }
    function 开一条(项) {
      项.起 = Date.now();
      在跑们.push(项);
      var 承;
      try {
        承 = Promise.resolve(做一条(项.条, 项.号));
      } catch (er) {
        承 = Promise.reject(er);
      }
      承.then(function(值) {
        落(项, true, 值);
      }, function(er) {
        落(项, false, er);
      });
    }
    function 落(项, 成, 值) {
      if (项.弃)
        return;
      在跑们.splice(在跑们.indexOf(项), 1);
      if (成)
        成们.push({ 条: 项.条, 值 });
      else
        记败(项, 值, false);
      补位();
    }
    function 补位() {
      while (态.在跑中 && !停了 && 队.length && 在跑们.length < 同时)
        开一条(队.shift());
      if (态.在跑中 && !在跑们.length && (停了 || !队.length))
        收尾();
      画();
      查慢();
    }
    var 放, 果承 = new Promise(function(ok) {
      放 = ok;
    }), 计时 = null;
    function 收尾() {
      态.在跑中 = false;
      clearInterval(计时);
      停钮.hidden = 慢行.hidden = true;
      if (停了) {
        注.textContent = 注.title = "撤掉排队 " + 撤们.length + " 个,没扣钱;停前发出的都回来了";
        if (败们.length) {
          败单.hidden = false;
          败钮.setAttribute("aria-expanded", "true");
        }
      }
      画();
      放({ 成: 成们, 没成: 败们, 撤掉: 撤们, 停了 });
    }
    function 慢们() {
      var 现 = Date.now();
      return 在跑们.filter(function(项) {
        return (现 - 项.起) / 1000 > 平常 * 2;
      });
    }
    function 查慢() {
      var 们 = 态.在跑中 ? 慢们() : [];
      慢行.hidden = !们.length;
      if (!们.length)
        return;
      var 现 = Date.now();
      var 最久 = Math.max.apply(null, 们.map(function(项) {
        return Math.floor((现 - 项.起) / 1000);
      }));
      慢字.textContent = "⚠ " + 们.length + " 条比平常慢,最久已等 " + 最久 + " 秒";
      慢行.title = 件.慢说(平常, "几次");
    }
    function 不等() {
      慢们().forEach(function(项) {
        项.弃 = true;
        在跑们.splice(在跑们.indexOf(项), 1);
        记败(项, 件.不等错(Math.round((Date.now() - 项.起) / 1000), 平常), true);
      });
      补位();
      if (停钮.isConnected && !停钮.hidden && !停钮.disabled)
        停钮.focus();
    }
    function 停() {
      if (停了 || !态.在跑中)
        return;
      停了 = true;
      撤们 = 队.splice(0).map(function(项) {
        return 项.条;
      });
      var 句 = "已撤掉排队 " + 撤们.length + " 个,不扣钱;在跑的 " + 在跑们.length + " 个跑完为止";
      注.textContent = 注.title = 停钮.title = 句;
      注.hidden = false;
      停钮.disabled = true;
      补位();
    }
    画();
    计时 = setInterval(查慢, 1000);
    var 前 = [];
    if (配.功能名) {
      前.push(族(配).then(function(j) {
        var n = Math.floor(Number(j && j.同时));
        if (n > 0 && !藏同时) {
          同时 = n;
          同时来自底座 = true;
        }
      }, 空), Promise.resolve().then(function() {
        return window.UI调用.平常(配.史口, 配.功能名);
      }).then(function(s) {
        平常 = s;
      }, 空));
    }
    Promise.all(前).then(补位);
    果承.停 = 停;
    return 果承;
  }
  function 模型选(旁, 配) {
    配 = 配 || {};
    var 原 = 旁._模型选;
    if (原 && 原.组.isConnected) {
      if (配.行们)
        原.设行们(配.行们);
      return 原;
    }
    var 功能名 = 配.功能名 || "", 挪口 = 配.挪口 || "/api/model-badge/move", 族口 = 配.族口 || "/api/model-badge/family";
    var 只 = !!配.只这一趟, 组 = 建("span", "模型选组"), 选 = 建("select", "模型选"), 错位 = 建("span");
    var 提 = 只 ? "只管这一趟:挑了这回先用它,不改全局先后,别的软件不受影响" : "挑一下改的是全局先后,别的软件调同一功能也跟着变";
    选.title = 提;
    选.setAttribute("aria-label", 功能名 + " · 先试哪个模型(" + 提 + ")");
    组.append(选);
    var 旁注 = 配.旁注 === undefined ? 只 : 配.旁注;
    if (旁注)
      组.append(建("span", "模型选-注", 旁注 === true ? 只 ? "只管这一趟,不改别处" : "选中的先答,没接上按顺序换" : String(旁注)));
    组.append(错位);
    旁.insertAdjacentElement("afterend", 组);
    var 行们 = [], 挑 = 0, 要挑 = 配.挑;
    function 占位(字) {
      var o = 建("option", null, 字);
      o.disabled = true;
      选.replaceChildren(o);
      选.disabled = true;
    }
    function 画(新) {
      var 留 = 只 && (要挑 || 行们[挑] && 行们[挑].功能名);
      行们 = 新;
      挑 = 0;
      要挑 = null;
      if (!行们.length) {
        占位("这一族是空的");
        return;
      }
      var 群 = 建("optgroup");
      群.label = 只 ? "只管这一趟 · 不改全局" : "挑谁谁先试 · 全局生效";
      行们.forEach(function(r, i) {
        var o = 建("option", null, 件.谁(false, r.模型, r.推理强度) + (r.备注 ? " · " + r.备注 : "") + (停用(r) ? " · 停用" : ""));
        o.value = String(i);
        o.title = 牌字(r);
        o.disabled = 停用(r);
        if (留 && r.功能名 === 留 && !o.disabled)
          挑 = i;
        群.append(o);
      });
      选.replaceChildren(群);
      选.selectedIndex = 挑;
      选.disabled = false;
    }
    function 显错(人话, er, 位置, 先) {
      var 条 = 件.错行("span", "调用-等 败", 人话, function() {
        var 段 = 件.错段(人话, er, 位置);
        return 先 ? 段 + `
── 在这之前 ──
` + 件.错段(先.人话, 先.er, 先.位置) : 段;
      });
      条.setAttribute("role", "alert");
      错位.replaceChildren(条);
    }
    function 告(i) {
      if (typeof 配.选 === "function")
        配.选(行们[i], i);
    }
    function 重读() {
      return 族(配).then(function(j) {
        画(j.行们 || []);
      });
    }
    选.addEventListener("change", function() {
      var r = 行们[Number(选.value)];
      if (只) {
        挑 = Number(选.value);
        告(挑);
        return;
      }
      if (!r || 选.selectedIndex === 0)
        return;
      错位.replaceChildren();
      选.disabled = true;
      选.setAttribute("aria-busy", "true");
      var 名 = r.功能名, 次 = 0;
      function 挪一格() {
        return 投(挪口, { 功能名: 名, 方向: "上" }).then(function(j) {
          var 新 = j.行们 || [];
          名 = j.这一行 || 名;
          var i = 新.findIndex(function(x) {
            return x.功能名 === 名;
          });
          if (i < 0)
            throw new Error("挪完在回包里找不到「" + 名 + "」这一行");
          if (i === 0)
            return 新;
          if (++次 > 新.length)
            throw new Error("挪了 " + 次 + " 回还没到第一行");
          return 挪一格();
        });
      }
      挪一格().then(function(新) {
        画(新);
        选.removeAttribute("aria-busy");
        选.focus();
        if (window.UI提示)
          window.UI提示("已换首选:" + 牌字(新[0]));
        告(0);
      }, function(er) {
        选.removeAttribute("aria-busy");
        var 挪错 = { 人话: "换首选没成,点复制把报错发给 AI 看", er, 位置: "模型选 · " + 名 + " 往上 · " + 挪口 };
        显错(挪错.人话, er, 挪错.位置);
        重读().catch(function(er2) {
          占位("读不到模型列表");
          显错("顺序没读回来,刷新页面再试", er2, "模型选 · 补读 · " + 族口 + " · " + 功能名, 挪错);
        });
      });
    });
    if (配.行们)
      画(配.行们);
    else {
      占位("⟳ 加载中…");
      重读().catch(function(er) {
        占位("读不到模型列表");
        显错("读不到模型列表,点复制把报错发给 AI 看", er, "模型选 · " + 族口 + " · " + 功能名);
      });
    }
    return 旁._模型选 = {
      组,
      选,
      刷新: 重读,
      值: function() {
        return 行们[挑] || null;
      },
      设行们: function(新) {
        错位.replaceChildren();
        画(新 || []);
      },
      get 行们() {
        return 行们;
      }
    };
  }
  window.UI长活 = { 跑 };
  window.UI模型选 = 模型选;
})();
(function() {
  if (window.UI提示 || !window.UI调用 || !window.UI调用._件)
    return;
  var 件 = window.UI调用._件, 建 = 件.建;
  var 栈 = null, 成条 = null;
  function 提示(字, 配) {
    配 = 配 || {};
    字 = String(字 == null ? "" : 字);
    var 条, 字位, 句, 计 = null, 剩 = 0, 起 = 0, 动 = 配.动作 && typeof 配.动作.做 === "function" ? 配.动作 : null;
    function 关() {
      clearTimeout(计);
      计 = null;
      条.remove();
      if (成条 === 条)
        成条 = null;
    }
    function 走(毫) {
      剩 = 毫;
      起 = Date.now();
      计 = setTimeout(关, 毫);
    }
    if (配.错) {
      句 = 字.replace(/^✗\s*/, "");
      条 = 件.错行("div", "提示条 错", 句, function() {
        return 件.报错段(句, 配.报错, 配.位置 || location.pathname, 配.错误号);
      });
      字位 = 条.firstChild;
      字位.className = "提示-字";
      条.setAttribute("role", "alert");
    } else {
      条 = 建("div", "提示条");
      条.setAttribute("role", "status");
      字位 = 建("span", "提示-字", 配.常驻 ? 字 : 字.replace(/^✓\s*/, ""));
      if (!配.常驻)
        条.append(建("i", "符 好", "✓"));
      条.append(字位);
    }
    if (动)
      条.append(件.钮("小钮 提示-钮", 动.字 || "↶ 撤销", function() {
        关();
        动.做();
      }));
    if (配.错) {
      var 叉 = 件.钮("小钮", "✗", 关);
      叉.title = "关闭";
      叉.setAttribute("aria-label", "关闭");
      条.append(叉);
    } else if (!配.常驻) {
      if (成条)
        成条._关();
      成条 = 条;
      走(动 ? 6000 : 3000);
      var 停 = function() {
        if (计) {
          clearTimeout(计);
          计 = null;
          剩 -= Date.now() - 起;
        }
      };
      var 续 = function(e) {
        if (计 || !条.isConnected)
          return;
        var 出 = e.type === "focusout";
        if (出 ? 条.matches(":hover") || 条.contains(e.relatedTarget) : 条.contains(document.activeElement))
          return;
        走(Math.max(剩, 1500));
      };
      条.addEventListener("mouseenter", 停);
      条.addEventListener("focusin", 停);
      条.addEventListener("mouseleave", 续);
      条.addEventListener("focusout", 续);
    }
    条._关 = 关;
    if (!栈 || !栈.isConnected) {
      栈 = 建("div", "提示栈");
      document.body.appendChild(栈);
    }
    栈.appendChild(条);
    return {
      关,
      条,
      字: function(新) {
        新 = String(新 == null ? "" : 新);
        if (配.错) {
          句 = 新.replace(/^✗\s*/, "");
          字位.textContent = "✗ " + 句;
        } else
          字位.textContent = 新;
      }
    };
  }
  var 开着 = null, 序 = 0;
  function 确认(选项) {
    选项 = 选项 || {};
    if (开着)
      开着(false);
    return new Promise(function(定) {
      var 原焦 = document.activeElement, 号 = "UI确认-" + ++序;
      var 幕 = 建("div", "确认幕"), 框 = 建("div", "确认框"), 题 = 建("h3", null, 选项.题 || "要继续吗?");
      题.id = 号 + "-题";
      件.属(框, { role: "alertdialog", "aria-modal": "true", "aria-labelledby": 题.id });
      框.append(题);
      if (选项.说) {
        var 说 = 建("p", null, 选项.说);
        说.id = 号 + "-说";
        框.setAttribute("aria-describedby", 说.id);
        框.append(说);
      }
      var 底 = 建("div", "确认框-钮");
      var 取消 = 件.钮("次钮", 选项.取消字 || "取消", function() {
        关(false);
      });
      var 做 = 件.钮(选项.危 === false ? "主钮" : "危钮", 选项.钮字 || "删除", function() {
        关(true);
      });
      底.append(取消, 做);
      框.append(底);
      幕.append(框);
      document.body.appendChild(幕);
      function 关(值) {
        if (!幕.isConnected)
          return;
        幕.remove();
        document.removeEventListener("keydown", 键, true);
        if (开着 === 关)
          开着 = null;
        if (原焦 && 原焦.isConnected && 原焦.focus)
          原焦.focus();
        定(!!值);
      }
      function 键(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          关(false);
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          (document.activeElement === 取消 ? 做 : 取消).focus();
        }
      }
      幕.addEventListener("click", function(e) {
        if (e.target === 幕)
          关(false);
      });
      document.addEventListener("keydown", 键, true);
      开着 = 关;
      取消.focus();
    });
  }
  window.UI提示 = 提示;
  window.UI确认 = 确认;
})();
(function() {
  if (window.UI格式)
    return;
  function 两(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function 转(d) {
    if (d == null || d === "")
      return null;
    d = d instanceof Date ? d : new Date(d);
    return isNaN(d) ? null : d;
  }
  function 数(n, 位) {
    if (n === null || n === undefined || n === "" || !isFinite(n = Number(n)))
      return "—";
    return n.toLocaleString("en-US", { minimumFractionDigits: 位 || 0, maximumFractionDigits: 位 || 0 });
  }
  var 币号 = { CNY: "¥", RMB: "¥", "¥": "¥", USD: "US$", US$: "US$", $: "US$" };
  function 钱(n, 币) {
    var s = 数(n, 2), 号 = 币号[币 || "CNY"] || 币 + " ";
    return s === "—" ? s : s.charAt(0) === "-" ? "-" + 号 + s.slice(1) : 号 + s;
  }
  function 秒(d) {
    d = 转(d);
    return d ? d.getFullYear() + "-" + 两(d.getMonth() + 1) + "-" + 两(d.getDate()) + " " + 两(d.getHours()) + ":" + 两(d.getMinutes()) + ":" + 两(d.getSeconds()) : "—";
  }
  function 时(d, 现) {
    d = 转(d);
    if (!d)
      return "—";
    现 = 转(现 || new Date);
    var 差 = (现 - d) / 1000;
    if (差 > -60 && 差 < 60)
      return "刚刚";
    if (差 > 0 && 差 < 3600)
      return Math.floor(差 / 60) + " 分钟前";
    if (差 > 0 && d.toDateString() === 现.toDateString())
      return Math.floor(差 / 3600) + " 小时前";
    return 秒(d).slice(0, 16);
  }
  var 计 = null;
  function 刷(根) {
    根 = 根 || document;
    if (!根.querySelectorAll)
      return 0;
    var 们 = 根.querySelectorAll("time[data-相对]");
    Array.prototype.forEach.call(们, function(e) {
      var d = e.getAttribute("datetime");
      e.textContent = 时(d);
      e.title = 秒(d);
    });
    if (们.length && !计)
      计 = setInterval(function() {
        if (!document.hidden)
          刷();
      }, 30000);
    return 们.length;
  }
  window.UI格式 = { 数, 钱, 时, 秒, 刷 };
  if (!document.querySelectorAll)
    return;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function() {
      刷();
    });
  else
    刷();
  document.addEventListener("visibilitychange", function() {
    if (计 && !document.hidden)
      刷();
  });
  document.addEventListener("mouseover", function(e) {
    var el = e.target.closest && e.target.closest(".截一行,.截两行"), 自 = "data-自题";
    if (!el || el.hasAttribute("title") && !el.hasAttribute(自))
      return;
    if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
      el.title = el.textContent.trim();
      el.setAttribute(自, "");
    } else if (el.hasAttribute(自)) {
      el.removeAttribute("title");
      el.removeAttribute(自);
    }
  });
})();
(function() {
  if (window.UI填错 || !window.UI调用 || !window.UI调用._件)
    return;
  var 件 = window.UI调用._件, 建 = 件.建, 序 = 0, 各 = Array.prototype.forEach;
  function 面(框) {
    return 框.UI搜选 ? 框.UI搜选.框 : 框;
  }
  function 错号(v) {
    return (v.id || (v.id = "UI框-" + ++序)) + "-错";
  }
  function 非空(v) {
    return String(v == null ? "" : v).trim() !== "";
  }
  function 清(框) {
    var v = 面(框), id = 错号(v), 行 = document.getElementById(id);
    if (行)
      行.remove();
    v.removeAttribute("aria-invalid");
    var 述 = (v.getAttribute("aria-describedby") || "").split(" ").filter(function(x) {
      return x && x !== id;
    }).join(" ");
    if (述)
      v.setAttribute("aria-describedby", 述);
    else
      v.removeAttribute("aria-describedby");
  }
  function 标(框, 话, 判) {
    var v = 面(框), id = 错号(v), 行 = document.getElementById(id);
    if (!行) {
      行 = 建("div", "错行");
      行.id = id;
      (v.closest(".搜选") || v).after(行);
      v.setAttribute("aria-describedby", ((v.getAttribute("aria-describedby") || "") + " " + id).trim());
    }
    行.textContent = "✗ " + String(话).replace(/^✗\s*/, "");
    v.setAttribute("aria-invalid", "true");
    v._判 = 判 || null;
    v._原 = 框;
  }
  function 跳(x) {
    var v = x && x.getAttribute && x.getAttribute("aria-invalid") === "true" ? x : (x || document).querySelector('[aria-invalid="true"]');
    if (v) {
      v.focus({ preventScroll: true });
      v.scrollIntoView({ block: "center" });
    }
  }
  function 查(项们) {
    var 首 = null;
    项们.forEach(function(x) {
      var 判 = x.判 || 非空;
      if (判(x.框.value, x.框))
        清(x.框);
      else {
        标(x.框, x.话, 判);
        首 = 首 || 面(x.框);
      }
    });
    跳(首);
    return !首;
  }
  function 清全(根) {
    各.call((根 || document).querySelectorAll('[aria-invalid="true"]'), function(v) {
      清(v._原 || v);
    });
  }
  function 筛框(t) {
    return t && t.classList && t.classList.contains("搜选-框");
  }
  function 再判(e) {
    var t = e.target;
    if (!t || !t.getAttribute || 筛框(t))
      return;
    var v = 面(t), 原 = v._原 || v;
    if (v.getAttribute("aria-invalid") === "true" && (!v._判 || v._判(原.value, 原)))
      清(原);
  }
  function 搜选(sel, 配) {
    if (sel.UI搜选)
      return sel.UI搜选;
    配 = 配 || {};
    var 壳 = 建("div", "搜选"), 框 = 建("input", "输入 搜选-框"), 单 = 建("ul", "搜选-单"), 显 = [], 活 = -1;
    框.type = "text";
    框.autocomplete = "off";
    框.spellcheck = false;
    框.placeholder = 配.占位 || sel.getAttribute("data-搜选") || "快搜 选项…";
    单.id = "UI搜选-" + ++序;
    单.setAttribute("role", "listbox");
    单.hidden = true;
    件.属(框, { role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false", "aria-controls": 单.id });
    if (sel.id) {
      框.id = sel.id + "-搜";
      var 签 = document.querySelector('label[for="' + sel.id + '"]');
      if (签)
        签.htmlFor = 框.id;
    }
    if (sel.getAttribute("aria-label"))
      框.setAttribute("aria-label", sel.getAttribute("aria-label"));
    sel.before(壳);
    壳.append(框, 单, sel);
    sel.hidden = true;
    sel.tabIndex = -1;
    function 回字() {
      var o = sel.options[sel.selectedIndex];
      框.value = o && o.value !== "" ? o.text : "";
      框.disabled = sel.disabled;
    }
    function 画(字) {
      字 = 字.trim().toLowerCase();
      单.replaceChildren();
      显 = [];
      活 = -1;
      各.call(sel.options, function(o, i) {
        if (o.value === "" || 字 && o.text.toLowerCase().indexOf(字) < 0 && o.value.toLowerCase().indexOf(字) < 0)
          return;
        if (o.disabled) {
          单.append(件.属(建("li", "搜选-禁", o.text), { role: "option", "aria-disabled": "true", title: o.title || "这项现在不能选" }));
          return;
        }
        var li = 件.属(建("li", "搜选-项", o.text), { role: "option", "aria-selected": String(i === sel.selectedIndex), id: 单.id + "-" + i });
        li._i = i;
        单.append(li);
        显.push(li);
      });
      if (!单.children.length)
        单.append(建("li", "搜选-无", "没有匹配的"));
    }
    function 挪(i) {
      if (!显.length)
        return;
      活 = (i + 显.length) % 显.length;
      显.forEach(function(li, k) {
        li.classList.toggle("活", k === 活);
      });
      框.setAttribute("aria-activedescendant", 显[活].id);
      显[活].scrollIntoView({ block: "nearest" });
    }
    function 开(字) {
      画(字 || "");
      单.hidden = false;
      框.setAttribute("aria-expanded", "true");
      挪(Math.max(0, 显.findIndex(function(li) {
        return li._i === sel.selectedIndex;
      })));
    }
    function 关() {
      单.hidden = true;
      框.setAttribute("aria-expanded", "false");
      框.removeAttribute("aria-activedescendant");
    }
    function 派() {
      ["input", "change"].forEach(function(k) {
        sel.dispatchEvent(new Event(k, { bubbles: true }));
      });
    }
    function 取(li) {
      sel.selectedIndex = li._i;
      关();
      回字();
      派();
    }
    框.addEventListener("click", function() {
      if (单.hidden) {
        开();
        框.select();
      }
    });
    框.addEventListener("input", function() {
      开(框.value);
      挪(0);
    });
    框.addEventListener("keydown", function(e) {
      var k = e.key, 开着 = !单.hidden;
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        if (!开着)
          开();
        else
          挪(活 + (k === "ArrowDown" ? 1 : -1));
      } else if (k === "Enter" && 开着) {
        e.preventDefault();
        if (活 >= 0)
          取(显[活]);
      } else if (k === "Escape" && 开着) {
        e.preventDefault();
        e.stopPropagation();
        关();
        回字();
      }
    });
    框.addEventListener("blur", function() {
      关();
      if (!框.value.trim() && sel.value !== "" && Array.prototype.some.call(sel.options, function(o) {
        return o.value === "";
      })) {
        sel.value = "";
        派();
      }
      回字();
    });
    单.addEventListener("mousedown", function(e) {
      e.preventDefault();
    });
    单.addEventListener("click", function(e) {
      var li = e.target.closest(".搜选-项");
      if (li)
        取(li);
    });
    sel.addEventListener("change", 回字);
    回字();
    return sel.UI搜选 = { 框, 刷新: function() {
      回字();
      if (!单.hidden)
        开(框.value);
    }, 开, 关 };
  }
  function 没存拦(根, 配) {
    配 = 配 || {};
    var 脏 = false;
    function 记(e) {
      if (!筛框(e && e.target))
        脏 = true;
    }
    function 交() {
      脏 = false;
    }
    function 问() {
      if (!脏 || !window.UI确认)
        return Promise.resolve(true);
      return window.UI确认({ 题: 配.题 || "改的还没存,走吗?", 说: 配.说 || "不存就走,刚才改的都不留", 钮字: "不存,走", 取消字: "留下" }).then(function(走) {
        if (走)
          脏 = false;
        return 走;
      });
    }
    根.addEventListener("input", 记);
    根.addEventListener("change", 记);
    根.addEventListener("submit", 交);
    window.addEventListener("beforeunload", function(e) {
      if (脏 && 根.isConnected) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    document.addEventListener("click", function(e) {
      if (!脏 || !根.isConnected || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target && a.target !== "_self" || a.hasAttribute("download") || /^javascript:/i.test(a.getAttribute("href")) || a.hash && a.href.split("#")[0] === location.href.split("#")[0])
        return;
      e.preventDefault();
      问().then(function(走) {
        if (走)
          location.href = a.href;
      });
    });
    return { 问, 存了: 交, 改了: 记, 脏: function() {
      return 脏;
    } };
  }
  window.UI填错 = { 标, 清, 查, 跳, 清全 };
  window.UI搜选 = 搜选;
  window.UI没存拦 = 没存拦;
  if (!document.querySelectorAll)
    return;
  document.addEventListener("input", 再判, true);
  document.addEventListener("change", 再判, true);
  function 全升() {
    各.call(document.querySelectorAll("select[data-搜选]"), function(s) {
      搜选(s);
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", 全升);
  else
    全升();
})();
(function() {
  if (window.UI分页 || !window.UI调用 || !window.UI调用._件 || !window.UI格式)
    return;
  var 件 = window.UI调用._件, 建 = 件.建, 格 = window.UI格式;
  function 图钮(字, 题, 点) {
    return 件.属(件.钮("次钮 图钮", 字, 点), { title: 题, "aria-label": 题 });
  }
  function 分页(壳, 配) {
    配 = 配 || {};
    var 键 = 配.键 || "页", 每键 = 键 === "页" ? "每页" : 键 + "每页", 档 = 配.档 || [20, 50, 100], 默 = 配.每页 || 50;
    var 参 = new URLSearchParams(location.search), 页 = Math.max(1, parseInt(参.get(键), 10) || 1);
    var 每 = parseInt(参.get(每键), 10), 共 = 配.共 == null ? null : 配.共;
    if (档.indexOf(每) < 0)
      每 = 默;
    var 计字 = 建("span", "分页-共"), 码 = 建("span", "分页-码"), 签 = 建("label", "分页-每", "每页"), 选 = 建("select", "输入");
    var 跳 = 件.属(建("label", "分页-跳", "跳至"), { title: "输入页码按回车跳;超出范围就到首页或末页" });
    var 跳框 = 件.属(建("input", "输入"), { type: "number", min: "1", inputmode: "numeric", "aria-label": "跳至第几页" });
    跳.append(跳框, "页");
    档.forEach(function(n) {
      var o = 建("option", null, n + " 条");
      o.value = n;
      选.append(o);
    });
    选.value = 每;
    签.append(选);
    壳.classList.add("分页");
    壳.replaceChildren(计字, 签, 码, 跳);
    var 窄 = window.matchMedia ? matchMedia("(max-width:640px)") : null;
    if (窄 && 窄.addEventListener)
      窄.addEventListener("change", 画);
    function 页数() {
      return Math.max(1, Math.ceil((共 || 0) / 每));
    }
    function 写() {
      var u = new URL(location.href), q = u.searchParams;
      if (页 > 1)
        q.set(键, 页);
      else
        q.delete(键);
      if (每 !== 默)
        q.set(每键, 每);
      else
        q.delete(每键);
      history.replaceState(history.state, "", u);
    }
    function 数钮(n) {
      var b = 图钮(String(n), "第 " + n + " 页", function() {
        到(n);
      });
      b.classList.add("号");
      if (n === 页) {
        b.className = "主钮 图钮 号";
        b.setAttribute("aria-current", "page");
      }
      return b;
    }
    function 画() {
      var N = 页数(), 邻 = 窄 && 窄.matches ? 0 : 1, 在 = 码.contains(document.activeElement);
      计字.textContent = 共 == null ? "" : "共 " + 格.数(共) + " 条";
      计字.hidden = 配.显共 === false;
      码.hidden = 跳.hidden = N <= 1;
      跳框.max = String(N);
      签.hidden = 共 != null && 共 <= 档[0];
      var 低 = Math.max(1, Math.min(页 - 邻, N - 2 * 邻)), 高 = Math.min(N, 低 + 2 * 邻), 号们 = [1];
      if (低 === 1)
        高 = Math.min(N, Math.max(高, 2));
      if (高 === N)
        低 = Math.max(1, Math.min(低, N - 1));
      for (var i = Math.max(2, 低);i <= 高; i++)
        号们.push(i);
      if (高 < N)
        号们.push(N);
      var 前 = 图钮("‹", "上一页", function() {
        到(页 - 1);
      }), 后 = 图钮("›", "下一页", function() {
        到(页 + 1);
      });
      前.disabled = 页 <= 1;
      后.disabled = 页 >= N;
      码.replaceChildren(前);
      号们.forEach(function(n, k) {
        var 差 = n - (号们[k - 1] || n);
        if (差 === 2)
          码.append(数钮(n - 1));
        else if (差 > 2)
          码.append(件.属(建("span", "分页-略", "…"), { "aria-hidden": "true" }));
        码.append(数钮(n));
      });
      码.append(后);
      if (在)
        (码.querySelector("[aria-current]") || 前).focus();
    }
    function 改() {
      写();
      画();
      if (配.变)
        配.变(页, 每);
    }
    function 到(n) {
      n = Math.min(Math.max(1, n), 页数());
      if (n !== 页) {
        页 = n;
        改();
      }
    }
    function 跳到() {
      var n = parseInt(跳框.value, 10);
      跳框.value = "";
      if (n === n)
        到(n);
    }
    跳框.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        跳到();
      }
    });
    跳框.addEventListener("change", 跳到);
    选.addEventListener("change", function() {
      每 = +选.value;
      页 = 1;
      改();
    });
    画();
    return {
      get 页() {
        return 页;
      },
      get 每页() {
        return 每;
      },
      到,
      设共: function(n) {
        共 = n;
        if (配.夹末页 !== false && 页 > 页数()) {
          页 = 页数();
          改();
        } else
          画();
      }
    };
  }
  function 更新于(壳, 配) {
    配 = 配 || {};
    var 时 = 件.属(建("time"), { "data-相对": "" }), 钮 = 图钮("↻", "刷新", 点);
    壳.classList.add("更新于");
    壳.replaceChildren("更新于", 时, 钮);
    function 设(d) {
      时.setAttribute("datetime", new Date(d || Date.now()).toISOString());
      格.刷(壳);
    }
    function 点() {
      if (!配.刷 || 钮.disabled)
        return;
      钮.disabled = true;
      钮.replaceChildren(建("i", "符 转", "↻"));
      Promise.resolve().then(配.刷).then(function() {
        设();
      }, function(er) {
        if (window.UI提示)
          window.UI提示("刷新没成", { 错: true, 报错: er && er.message || String(er), 位置: location.pathname + " · 刷新" });
      }).then(function() {
        钮.disabled = false;
        钮.textContent = "↻";
      });
    }
    设(配.时);
    return { 设 };
  }
  function 净说明(源) {
    var 出 = document.createDocumentFragment();
    [].forEach.call(源.childNodes, function(n) {
      if (n.nodeType === 3)
        出.append(n.nodeValue);
      else if (n.nodeType !== 1)
        return;
      else if (n.tagName === "BR")
        出.append(建("br"));
      else if (n.tagName === "A" && /^(https?:\/\/|\/|\.{0,2}\/|#)/i.test(n.getAttribute("href") || "")) {
        var a = 建("a", null, n.textContent);
        a.href = n.getAttribute("href");
        if (!/^#/.test(a.getAttribute("href"))) {
          a.target = "_blank";
          a.rel = "noopener";
        }
        出.append(a);
      } else
        出.append(净说明(n));
    });
    return 出;
  }
  window.UI分页 = 分页;
  window.UI更新于 = 更新于;
  if (!document.querySelectorAll)
    return;
  document.addEventListener("click", function(e) {
    var 收 = e.target.closest && e.target.closest("[data-收]");
    var 块 = 收 && document.getElementById(收.getAttribute("data-收"));
    if (块) {
      e.preventDefault();
      e.stopPropagation();
      var 开 = 块.classList.toggle("开");
      收.setAttribute("aria-controls", 块.id);
      收.setAttribute("aria-expanded", String(开));
      return;
    }
    var 点 = e.target.closest && e.target.closest(".说明点");
    if (!点)
      return;
    e.preventDefault();
    e.stopPropagation();
    var 段 = 点._段;
    if (!段) {
      段 = 点._段 = 件.属(建("div", "说明展"), { id: "UI说明-" + Math.random().toString(36).slice(2, 8) });
      var 模 = 点.querySelector("template");
      if (模)
        段.append(净说明(模.content));
      else
        段.textContent = 点.title;
      段.hidden = true;
      点.setAttribute("aria-controls", 段.id);
      var 位 = 点.closest("label,dt,h1,h2,h3,h4");
      if (位)
        位.after(段);
      else
        点.parentElement.append(段);
    }
    段.hidden = !段.hidden;
    点.setAttribute("aria-expanded", String(!段.hidden));
  }, true);
})();
(function() {
  var 布 = window.UI布局, 件 = window.UI调用 && window.UI调用._件;
  if (window.UI列宽 || !布 || !布._拖宽 || !件)
    return;
  var 建 = 件.建, D = document, 笔, 编 = null, 点时 = 0, 点型 = "", 装了;
  function 提(字, 配) {
    return window.UI提示 && window.UI提示(字, 配);
  }
  function 头(表) {
    var h = 表.tHead;
    return h ? [].slice.call(h.rows[h.rows.length - 1].cells) : [];
  }
  function 名(th) {
    return th ? (th.dataset.列 || th.textContent).replace(/[✎↕▲▼]/g, "").trim() : "";
  }
  function 柱(表) {
    return [].slice.call(表.querySelectorAll(":scope > colgroup > col"));
  }
  function 存本(k, v) {
    try {
      v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k);
    } catch (e) {}
  }
  function 列宽(表, 配) {
    if (表._列宽) {
      表._列宽.刷();
      return 表._列宽;
    }
    配 = 配 || {};
    var 键 = 配.键 && "ui:列宽:" + 配.键, 记 = {}, 小 = 配.小 || 48, 吞 = 0, 观 = null, 框宽 = -1, 显 = "";
    try {
      记 = 键 && JSON.parse(localStorage.getItem(键)) || {};
    } catch (e) {}
    function 号(th) {
      return th.dataset.列 || th.cellIndex;
    }
    function 宽(th, px) {
      if (th._页宽 === undefined)
        th._页宽 = th.style.width;
      th.style.width = px + "px";
      var c = 柱(表)[th.cellIndex];
      if (c)
        c.style.width = px + "px";
    }
    function 设(th, px) {
      if (!表.classList.contains("列宽定")) {
        if (!表._原柱) {
          表._原柱 = 柱(表).map(function(c) {
            return c.style.width;
          });
          表._原宽 = 表.style.width;
        }
        头(表).map(function(t) {
          return [t, t.offsetWidth];
        }).forEach(function(a) {
          if (a[1])
            宽(a[0], a[1]);
        });
        表.classList.add("列宽定");
      }
      宽(th, px);
      表.style.width = 头(表).reduce(function(s, t) {
        return s + (t.offsetWidth ? parseFloat(t.style.width) || 0 : 0);
      }, 0) + "px";
    }
    function 有行() {
      return 表.rows.length > (表.tHead ? 表.tHead.rows.length : 0) + (表.tFoot ? 表.tFoot.rows.length : 0);
    }
    function 刷() {
      表.classList.add("列可拖");
      if (表.classList.contains("列宽定") && Object.keys(记).length)
        松();
      var 钉 = 有行();
      头(表).forEach(function(th) {
        if (!th.querySelector(".列把"))
          装把(th);
        if (钉 && 记[号(th)])
          设(th, Math.max(小, 记[号(th)]));
      });
      if (!钉 && Object.keys(记).length)
        等行();
      观头();
    }
    function 等行() {
      if (表._等行 || !window.MutationObserver)
        return;
      表._等行 = new MutationObserver(function() {
        if (!有行())
          return;
        表._等行.disconnect();
        表._等行 = null;
        刷();
      });
      表._等行.observe(表, { childList: true, subtree: true });
    }
    function 装把(th) {
      var 把 = 件.属(建("span", "列把"), { "aria-label": "「" + 名(th) + "」列宽,左右键调" });
      th.append(把);
      布._拖宽(把, function(px) {
        吞 = 1;
        setTimeout(function() {
          吞 = 0;
        });
        记[号(th)] = Math.round(px);
        if (键)
          存本(键, 记);
      }, function() {
        return th.getBoundingClientRect().width;
      }, function(px) {
        设(th, px);
      }, { 小, 大: 配.大 || 800, 静: 1 });
    }
    刷();
    表.addEventListener("click", function(e) {
      if (吞 || e.target.closest(".列把")) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
    function 松() {
      表.classList.remove("列宽定");
      表.style.width = 表._原宽 || "";
      头(表).forEach(function(th) {
        if (th._页宽 !== undefined) {
          th.style.width = th._页宽;
          delete th._页宽;
        }
      });
      if (表._原柱)
        柱(表).forEach(function(c, i) {
          c.style.width = 表._原柱[i] || "";
        });
    }
    function 恢复() {
      记 = {};
      if (键)
        存本(键);
      松();
    }
    function 观头() {
      if (!window.ResizeObserver || !表.parentElement)
        return;
      if (!观)
        观 = new ResizeObserver(function() {
          var w = 表.parentElement ? 表.parentElement.clientWidth : 0, s = 头(表).map(function(t) {
            return t.offsetWidth ? 1 : 0;
          }).join("");
          if (!w || w === 框宽 && s === 显)
            return;
          框宽 = w;
          显 = s;
          if (!表.classList.contains("列宽定") || !Object.keys(记).length)
            return;
          松();
          头(表).forEach(function(th) {
            if (记[号(th)])
              设(th, Math.max(小, 记[号(th)]));
          });
        });
      观.observe(表.parentElement);
      头(表).forEach(function(th) {
        观.observe(th);
      });
    }
    if (配.钮)
      配.钮.addEventListener("click", function() {
        恢复();
        提("已恢复默认列宽");
      });
    return 表._列宽 = { 恢复, 刷 };
  }
  function 格于(x) {
    var 格 = x && x.closest && x.closest("td.改"), t = 格 && 格.closest("table");
    return t && t._格改 && !卡片中(t) ? 格 : null;
  }
  function 卡片中(t) {
    return t.classList.contains("机卡表") && !t.classList.contains("机看表") && !!window.matchMedia && matchMedia("(max-width:640px)").matches;
  }
  function 列名(格) {
    return 名(头(格.closest("table"))[格.cellIndex]) || "内容";
  }
  function 亮(格) {
    if (编 && 编.格 === 格)
      return;
    if (!笔) {
      笔 = 件.钮("格改笔", "", function(e) {
        e.stopPropagation();
        进(笔.parentNode);
      });
      笔.title = "改这一格(点格子本身不进编辑)";
    }
    笔.setAttribute("aria-label", "改这一格:" + 列名(格));
    if (笔.parentNode !== 格)
      格.append(笔);
    笔.hidden = false;
  }
  function 刚触() {
    return 点型 === "touch" && Date.now() - 点时 < 1000;
  }
  function 熄() {
    var a = D.activeElement;
    if (笔 && a !== 笔 && a !== 笔.parentNode)
      笔.hidden = true;
  }
  function 进(格) {
    if (编) {
      编.接 = 格;
      return;
    }
    var 选 = 格.dataset.选项, 旧 = 格.dataset.值 != null ? 格.dataset.值 : 格.textContent.trim(), 框;
    if (选 != null) {
      框 = 建("select");
      选.split("|").forEach(function(v) {
        框.append(new Option(v, v));
      });
    } else
      框 = 建(格.hasAttribute("data-多行") ? "textarea" : "input");
    框.className = "格改框";
    框.value = 旧;
    框.setAttribute("aria-label", 列名(格));
    框.onkeydown = function(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!编.忙) {
          收();
          格.focus();
        }
      } else if (e.key === "Enter" && 框.tagName === "INPUT")
        e.preventDefault();
    };
    框.onfocusout = function(e) {
      if (Date.now() - 点时 > 500 && e.relatedTarget && !格.contains(e.relatedTarget))
        出();
    };
    if (笔)
      笔.hidden = true;
    格.classList.add("改中");
    格.append(框);
    编 = { 格, 框, 旧, 配: 格.closest("table")._格改 };
    框.focus();
    if (框.select)
      框.select();
  }
  function 收() {
    var e = 编;
    编 = null;
    if (e.错条)
      e.错条.关();
    e.框.remove();
    e.格.classList.remove("改中");
    e.格.removeAttribute("aria-busy");
  }
  function 败(e, er) {
    var m = er && er.message || String(er), 话 = er && er.人话 || (/^[^\x00-\x7f]{1,20}$/.test(m) ? m : "点格子外面重试,Esc 放弃");
    e.忙 = false;
    e.接 = null;
    e.框.disabled = false;
    e.格.removeAttribute("aria-busy");
    e.框.setAttribute("aria-invalid", "true");
    if (e.错条)
      e.错条.关();
    e.错条 = 提("保存没成:" + 话, { 错: true, 报错: m, 位置: location.pathname + " · 列 " + 列名(e.格) });
    e.框.focus();
  }
  function 出() {
    var e = 编;
    if (!e || e.忙)
      return;
    var 新 = e.框.value, 校错;
    if (新 === e.旧)
      return 收();
    if (校错 = e.配.校 && e.配.校(e.格, 新))
      return 败(e, { message: 校错, 人话: 校错 });
    e.忙 = true;
    e.框.disabled = true;
    e.格.setAttribute("aria-busy", "true");
    Promise.resolve().then(function() {
      return e.配.存(e.格, 新, e.旧);
    }).then(function(显) {
      收();
      if (显 && !显.nodeType && 显.作罢) {
        if (e.接)
          进(e.接);
        return;
      }
      var 暂 = !!(显 && !显.nodeType && 显.暂存);
      if (暂)
        显 = 显.显;
      if (显 && 显.nodeType)
        e.格.replaceChildren(显);
      else
        e.格.textContent = typeof 显 === "string" ? 显 : 新;
      if (e.格.dataset.值 != null)
        e.格.dataset.值 = 新;
      提(暂 ? "已暂存在本行,还没写进库" : "已保存");
      if (e.接)
        进(e.接);
    }, function(er) {
      败(e, er);
    });
  }
  function 格改(表, 配) {
    if (!装了) {
      装了 = 1;
      D.addEventListener("mouseover", function(e) {
        var 格 = 格于(e.target);
        if (!格)
          熄();
        else if (!刚触())
          亮(格);
      });
      D.addEventListener("focusin", function(e) {
        if (格于(e.target) === e.target && !刚触())
          亮(e.target);
      });
      D.addEventListener("click", function(e) {
        var 格 = 格于(e.target);
        if (格 && !编)
          亮(格);
      });
      D.addEventListener("pointerdown", function(e) {
        点时 = Date.now();
        点型 = e.pointerType;
        if (!编 || 编.格.contains(e.target) || e.target.closest(".提示栈,.确认幕"))
          return;
        if (e.pointerType === "mouse" || 编.框.value === 编.旧)
          return 出();
        var 兜, 走 = function() {
          D.removeEventListener("click", 走, true);
          clearTimeout(兜);
          setTimeout(出, 0);
        };
        兜 = setTimeout(走, 600);
        D.addEventListener("click", 走, true);
      }, true);
    }
    表._格改 = 配 || {};
    function 刷() {
      [].forEach.call(表.querySelectorAll("td.改"), function(td) {
        if (td.tabIndex < 0)
          td.tabIndex = 0;
      });
    }
    刷();
    return { 刷 };
  }
  window.UI列宽 = 列宽;
  window.UI格改 = 格改;
})();
(function() {
  if (window.UI改动历史 || !window.UI调用 || !window.UI调用._件 || !window.UI确认 || !window.UI提示)
    return;
  var 件 = window.UI调用._件, 建 = 件.建, 开着 = null;
  function 字(v) {
    return v == null || v === "" ? "—" : String(v);
  }
  function 话(er) {
    return er && er.message || String(er);
  }
  function 格(类, 值, 标) {
    var td = 建("td", 类 || null, 字(值));
    if (标)
      td.dataset.标 = 标;
    return td;
  }
  function 抽屉(题, 层名) {
    if (开着)
      开着();
    var 原焦 = document.activeElement;
    var 幕 = 建("div", "弹窗遮幕 抽屉幕"), 壳 = 建("div", "弹窗外壳 弹窗抽屉"), 栏 = 建("div", "弹窗标题栏");
    var 叉 = 件.钮("弹窗关闭钮", "✗", function() {
      if (!window.UI叠层)
        藏();
    });
    var 体 = 建("div", "弹窗正文");
    叉.title = "关闭";
    叉.setAttribute("aria-label", "关闭");
    件.属(壳, { role: "dialog", "aria-modal": "true", "aria-label": 题 });
    栏.append(建("h2", "弹窗标题", 题), 叉);
    壳.append(栏, 体);
    幕.append(壳);
    document.body.appendChild(幕);
    function 藏() {
      if (!幕.isConnected)
        return;
      幕.remove();
      if (开着 === 藏)
        开着 = null;
      if (原焦 && 原焦.isConnected && 原焦.focus)
        原焦.focus();
    }
    幕.addEventListener("click", function(e) {
      if (e.target === 幕)
        藏();
    });
    if (window.UI叠层)
      window.UI叠层.压(幕, { 名: 层名, 关: 藏, 钮位: ".弹窗标题栏" });
    else
      document.addEventListener("keydown", function 键(e) {
        if (!幕.isConnected)
          return document.removeEventListener("keydown", 键);
        if (e.key === "Escape" && !e.defaultPrevented)
          藏();
      });
    开着 = 藏;
    叉.focus();
    return { 体, 藏 };
  }
  function 拉(抽, 名, 取, 画) {
    var 计 = setTimeout(function() {
      抽.体.replaceChildren(空("⟳ 加载中…"));
    }, 500);
    return Promise.resolve().then(取).then(function(d) {
      clearTimeout(计);
      画(d);
    }, function(er) {
      clearTimeout(计);
      var 句 = 名 + "没拿到";
      var 行 = 件.错行("div", "抽屉错", 句, function() {
        return 件.报错段(句, 话(er), location.pathname + " · " + 名, "无");
      });
      行.append(件.钮("小钮", "再试", function() {
        拉(抽, 名, 取, 画);
      }));
      抽.体.replaceChildren(行);
    });
  }
  function 空(句, 悬) {
    var d = 建("div", "空"), p = 建("p", "空话", 句);
    if (悬)
      p.title = 悬;
    d.append(p);
    return d;
  }
  function 表头(字们) {
    var 头 = 建("thead"), tr = 建("tr");
    字们.forEach(function(s) {
      tr.append(建("th", null, s));
    });
    头.append(tr);
    return 头;
  }
  function 改动历史(选) {
    选 = 选 || {};
    var 名 = 选.名 == null ? "" : String(选.名);
    var 抽 = 抽屉("改动历史" + (名 ? " · " + 名 : ""), "改动历史");
    function 画(行们) {
      行们 = 行们 || [];
      if (!行们.length)
        return 抽.体.replaceChildren(空("还没有改动记录", "这条记录建好以后没人改过;改一格就会在这儿记一行。"));
      var 表 = 建("table", "抽屉表 史表"), 身 = 建("tbody");
      表.append(表头(["时间", "字段", "改前", "改后", ""]), 身);
      行们.forEach(function(行) {
        var tr = 建("tr"), 钮格 = 建("td", "钮格");
        if (行.新建)
          tr.append(格("时", 行.时), 格("", "新建"), 格("无", "—"), 格("无", "—"));
        else {
          tr.append(格("时", 行.时), 格("", 行.字段), 格("前", 行.前, "改前"), 格("后", 行.后, "改后"));
          var 钮 = 件.钮("小钮", "↩ 退回", function() {
            window.UI确认({
              题: "把「" + 字(行.字段) + "」退回?",
              说: "会从「" + 字(行.后) + "」变回「" + 字(行.前) + `」。
退回也记一行,还能再退回来。`,
              钮字: "退回"
            }).then(function(要) {
              if (!要)
                return;
              钮.disabled = true;
              Promise.resolve().then(function() {
                return 选.退(行);
              }).then(function() {
                window.UI提示("已退回「" + 字(行.字段) + "」");
                刷();
              }, function(er) {
                钮.disabled = false;
                window.UI提示("退回没成", { 错: true, 报错: 话(er), 位置: location.pathname + " · 改动历史 · " + 字(行.字段) });
              });
            });
          });
          钮.title = "这一格变回「" + 字(行.前) + "」;点了先问一句";
          钮格.append(钮);
        }
        tr.append(钮格);
        身.append(tr);
      });
      抽.体.replaceChildren(表);
    }
    function 刷() {
      return 拉(抽, "改动历史", 选.取, 画);
    }
    刷();
    return { 关: 抽.藏, 刷 };
  }
  function 回收站(选) {
    选 = 选 || {};
    var 名 = 选.名 == null ? "" : String(选.名);
    var 抽 = 抽屉("回收站" + (名 ? " · " + 名 : ""), "回收站");
    function 数(n) {
      var 计 = 选.钮 && 选.钮.querySelector(".计");
      if (计)
        计.textContent = n;
    }
    function 画(d) {
      d = Array.isArray(d) ? { 条们: d } : d || {};
      var 条们 = d.条们 || [];
      数(条们.length);
      var 注 = 建("p", "抽屉注", "共 " + 条们.length + " 条" + (d.说 ? " · " + d.说 : ""));
      if (!条们.length)
        return 抽.体.replaceChildren(注, 空("回收站是空的", "删掉的东西先放在这儿,点「↩ 还原」回到原处。"));
      var 有类 = 条们.some(function(x) {
        return x.类型;
      }), 有处 = 条们.some(function(x) {
        return x.原来在;
      });
      var 表 = 建("table", "抽屉表 回收表"), 身 = 建("tbody");
      表.append(表头(["名字"].concat(有类 ? ["类型"] : [], 有处 ? ["原来在"] : [], ["删于", ""])), 身);
      function 一行(条, 批) {
        var 子们 = !批 && Array.isArray(条.子们) && 条.子们.length ? 条.子们 : null, 内们 = [];
        var tr = 建("tr", 批 ? "批内" : null), 钮格 = 建("td", "钮格"), 名格 = 格("名", 条.名字);
        if (子们) {
          var 开 = 件.钮("小钮 批开", "▸", function() {
            var 展 = 开.getAttribute("aria-expanded") !== "true";
            开.setAttribute("aria-expanded", String(展));
            开.textContent = 展 ? "▾" : "▸";
            内们.forEach(function(r) {
              r.hidden = !展;
            });
          });
          开.setAttribute("aria-expanded", "false");
          开.title = "展开看这一批 " + 子们.length + " 条,单条也能还原";
          名格.prepend(开, " ");
        }
        tr.append(名格);
        if (有类)
          tr.append(格("", 条.类型, "类型"));
        if (有处)
          tr.append(格("", 条.原来在, "原来在"));
        tr.append(格("时", 条.删于, "删于"));
        var 钮 = 件.钮("小钮", 子们 ? "↩ 整批还原" : "↩ 还原", function() {
          钮.disabled = true;
          Promise.resolve().then(function() {
            return 选.还原(条, 批 || null);
          }).then(function() {
            window.UI提示("「" + 字(条.名字) + "」已还原");
            刷();
          }, function(er) {
            钮.disabled = false;
            window.UI提示("还原没成", { 错: true, 报错: 话(er), 位置: location.pathname + " · 回收站 · " + 字(条.名字) });
          });
        });
        钮.title = 子们 ? "这一批 " + 子们.length + " 条一起放回原处" : "放回原处" + (条.原来在 ? "(" + 条.原来在 + ")" : "");
        钮格.append(钮);
        tr.append(钮格);
        身.append(tr);
        if (子们)
          子们.forEach(function(子) {
            var r = 一行(子, 条);
            r.hidden = true;
            内们.push(r);
          });
        return tr;
      }
      条们.forEach(function(条) {
        一行(条, null);
      });
      抽.体.replaceChildren(注, 表);
    }
    function 刷() {
      return 拉(抽, "回收站", 选.取, 画);
    }
    刷();
    return { 关: 抽.藏, 刷 };
  }
  window.UI改动历史 = 改动历史;
  window.UI回收站 = 回收站;
})();
(function() {
  var 窗 = null, 台, 图, 名格, 数格, 比钮, 上钮, 下钮, 坏, 载;
  var 组 = [], 号 = 0, 回焦 = null, 压了 = false;
  var 比 = 1, 适 = 1, x = 0, y = 0, 宽 = 0, 高 = 0;
  var 指 = new Map, 拖起 = null, 捏起 = null, 动了 = false, 上次点 = 0;
  var 最小 = 0.1, 最大 = 8;
  function 建(标签, 类, 字) {
    var e = document.createElement(标签);
    if (类)
      e.className = 类;
    if (字 != null)
      e.textContent = 字;
    return e;
  }
  function 钮(类, 字, 题, 干) {
    var b = 建("button", "看图-钮 " + (类 || ""), 字);
    b.type = "button";
    b.title = 题;
    b.setAttribute("aria-label", 题);
    b.addEventListener("click", function(e) {
      e.stopPropagation();
      干();
    });
    return b;
  }
  function 装() {
    if (窗)
      return;
    窗 = 建("dialog", "看图");
    窗.setAttribute("aria-label", "看大图");
    var 栏 = 建("div", "看图-栏");
    名格 = 建("div", "看图-名");
    数格 = 建("div", "看图-数");
    比钮 = 钮("看图-比", "100%", "在「适应窗口」和 100% 原尺寸之间切", function() {
      切比();
    });
    var 缩 = 建("div", "看图-组 缩");
    缩.append(钮("", "−", "缩小(也可滚轮 / 双指)", function() {
      按中缩(1 / 1.25);
    }), 比钮, 钮("", "+", "放大(也可滚轮 / 双指)", function() {
      按中缩(1.25);
    }), 钮("", "适应", "整张放进窗口", function() {
      适应();
    }));
    var 关 = 钮("看图-关", "✗", "关掉大图,回到上一层(点图外面、按 Esc 也行)", function() {
      退出();
    });
    var 右 = 建("div", "看图-组");
    右.append(关);
    栏.append(名格, 数格, 缩, 右);
    台 = 建("div", "看图-台");
    图 = 建("img");
    图.alt = "";
    图.draggable = false;
    上钮 = 钮("看图-翻 上", "‹", "上一张(←)", function() {
      翻(-1);
    });
    下钮 = 钮("看图-翻 下", "›", "下一张(→)", function() {
      翻(1);
    });
    坏 = 建("div", "看图-坏");
    坏.hidden = true;
    载 = 建("div", "看图-载", "加载中…");
    载.hidden = true;
    台.append(图, 上钮, 下钮, 坏, 载);
    窗.append(栏, 台);
    document.body.appendChild(窗);
    图.addEventListener("load", function() {
      载.hidden = true;
      宽 = 图.naturalWidth || 1;
      高 = 图.naturalHeight || 1;
      图.style.width = 宽 + "px";
      图.style.height = 高 + "px";
      图.hidden = false;
      适应();
    });
    图.addEventListener("error", function() {
      载.hidden = true;
      图.hidden = true;
      var 项 = 组[号] || {};
      var 件 = window.UI调用 && window.UI调用._件;
      var 话 = "这张图没打开,地址可能失效了";
      坏.replaceChildren(建("div", "", "✗ " + 话));
      if (件)
        坏.append(件.复制钮(function() {
          return 件.报错段(话, "图片加载失败:" + (项.src || "(空)"), location.href + " · 看大图", "IMG_LOAD");
        }));
      坏.hidden = false;
    });
    台.addEventListener("click", function(e) {
      if (动了) {
        动了 = false;
        return;
      }
      if (e.target === 台)
        退出();
    });
    栏.addEventListener("click", function(e) {
      if (e.target === 栏)
        退出();
    });
    窗.addEventListener("click", function(e) {
      if (e.target === 窗)
        退出();
    });
    窗.addEventListener("cancel", function(e) {
      e.preventDefault();
    });
    addEventListener("keydown", function(e) {
      if (!窗.open || e.isComposing)
        return;
      var k = e.key;
      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        退出();
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        翻(-1);
      } else if (k === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        翻(1);
      } else if (k === "+" || k === "=") {
        e.preventDefault();
        e.stopPropagation();
        按中缩(1.25);
      } else if (k === "-") {
        e.preventDefault();
        e.stopPropagation();
        按中缩(1 / 1.25);
      } else if (k === "0") {
        e.preventDefault();
        e.stopPropagation();
        适应();
      }
    }, true);
    ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"].forEach(function(t) {
      窗.addEventListener(t, function(e) {
        e.stopPropagation();
      });
    });
    台.addEventListener("wheel", function(e) {
      e.preventDefault();
      var r = 台.getBoundingClientRect();
      缩到(比 * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    台.addEventListener("pointerdown", 按下);
    台.addEventListener("pointermove", 移);
    台.addEventListener("pointerup", 抬);
    台.addEventListener("pointercancel", 抬);
    addEventListener("resize", function() {
      if (窗.open)
        校缩放();
      if (窗.open && 宽)
        适应();
    });
  }
  function 取缩放(el) {
    var 串 = String(getComputedStyle(el).zoom || "").trim();
    var v = parseFloat(串);
    if (/%$/.test(串))
      v = v / 100;
    return v > 0 ? v : 1;
  }
  function 校缩放() {
    if (!窗)
      return;
    var z = 取缩放(document.documentElement) * (document.body ? 取缩放(document.body) : 1);
    if (Math.abs(z - 1) < 0.001) {
      if (窗.style.zoom) {
        窗.style.removeProperty("zoom");
        if (!窗.getAttribute("style"))
          窗.removeAttribute("style");
      }
    } else
      窗.style.setProperty("zoom", String(1 / z));
  }
  function 画() {
    图.style.transform = "translate(" + x + "px," + y + "px) scale(" + 比 + ")";
    比钮.textContent = Math.round(比 * 100) + "%";
  }
  function 夹(v) {
    return Math.min(最大, Math.max(最小, v));
  }
  function 缩到(新, 点x, 点y) {
    新 = 夹(新);
    x = 点x - (点x - x) * 新 / 比;
    y = 点y - (点y - y) * 新 / 比;
    比 = 新;
    画();
  }
  function 按中缩(倍) {
    缩到(比 * 倍, 台.clientWidth / 2, 台.clientHeight / 2);
  }
  function 适应() {
    if (!宽)
      return;
    var { clientWidth: w, clientHeight: h } = 台;
    适 = Math.min(1, (w - 24) / 宽, (h - 24) / 高);
    if (!(适 > 0))
      适 = 1;
    比 = 适;
    x = (w - 宽 * 比) / 2;
    y = (h - 高 * 比) / 2;
    画();
  }
  function 切比() {
    if (Math.abs(比 - 1) < 0.001)
      适应();
    else
      缩到(1, 台.clientWidth / 2, 台.clientHeight / 2);
  }
  function 按下(e) {
    if (e.target !== 图 && e.target !== 台)
      return;
    台.setPointerCapture(e.pointerId);
    指.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (指.size === 1) {
      拖起 = { 点x: e.clientX, 点y: e.clientY, x, y };
      if (e.target === 图)
        台.classList.add("拖");
    } else if (指.size === 2) {
      var p = Array.from(指.values());
      var r = 台.getBoundingClientRect();
      捏起 = {
        距: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
        比,
        中x: (p[0].x + p[1].x) / 2 - r.left,
        中y: (p[0].y + p[1].y) / 2 - r.top
      };
      拖起 = null;
    }
  }
  function 移(e) {
    if (!指.has(e.pointerId))
      return;
    指.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (捏起 && 指.size >= 2) {
      var p = Array.from(指.values());
      var 距 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      缩到(捏起.比 * 距 / 捏起.距, 捏起.中x, 捏起.中y);
      动了 = true;
    } else if (拖起) {
      var dx = e.clientX - 拖起.点x, dy = e.clientY - 拖起.点y;
      if (Math.abs(dx) + Math.abs(dy) > 4)
        动了 = true;
      if (动了) {
        x = 拖起.x + dx;
        y = 拖起.y + dy;
        画();
      }
    }
  }
  function 抬(e) {
    if (!指.has(e.pointerId))
      return;
    指.delete(e.pointerId);
    if (指.size < 2)
      捏起 = null;
    if (!指.size) {
      台.classList.remove("拖");
      var 是点 = !动了 && e.type === "pointerup" && e.target === 图;
      拖起 = null;
      if (是点) {
        var 今 = Date.now();
        if (今 - 上次点 < 300) {
          上次点 = 0;
          var r = 台.getBoundingClientRect();
          if (比 > 适 + 0.001)
            适应();
          else
            缩到(Math.max(2, 适 * 2), e.clientX - r.left, e.clientY - r.top);
        } else
          上次点 = 今;
      }
      if (动了)
        setTimeout(function() {
          动了 = false;
        }, 0);
    }
  }
  function 显(i) {
    号 = (i + 组.length) % 组.length;
    var 项 = 组[号];
    名格.textContent = 项.名 || "";
    名格.title = 项.名 || "";
    数格.textContent = 组.length > 1 ? 号 + 1 + " / " + 组.length : "";
    上钮.hidden = 下钮.hidden = 组.length < 2;
    坏.hidden = true;
    宽 = 0;
    图.hidden = true;
    载.hidden = false;
    图.alt = 项.名 || "";
    图.removeAttribute("src");
    图.src = 项.src;
  }
  function 翻(步) {
    if (组.length > 1)
      显(号 + 步);
  }
  function 藏() {
    if (!窗 || !窗.open)
      return;
    窗.close();
    图.removeAttribute("src");
    压了 = false;
    if (回焦 && 回焦.isConnected) {
      try {
        回焦.focus({ preventScroll: true });
      } catch (e) {}
    }
  }
  function 退出() {
    if (压了 && window.UI叠层 && window.UI叠层.顶() === 窗)
      window.UI叠层.退();
    else
      藏();
  }
  function 规整(图们) {
    if (!Array.isArray(图们))
      图们 = [图们];
    return 图们.map(function(g) {
      return typeof g === "string" ? { src: g } : g;
    }).filter(function(g) {
      return g && g.src;
    });
  }
  function 开(图们, 起号, 设) {
    设 = 设 || {};
    var 列 = 规整(图们);
    if (!列.length)
      throw new Error("UI看图.开:没给图片地址");
    if (设.名 && 列.length === 1 && !列[0].名)
      列[0].名 = 设.名;
    装();
    校缩放();
    回焦 = document.activeElement;
    组 = 列;
    if (!窗.open) {
      窗.showModal();
      if (window.UI叠层) {
        window.UI叠层.压(窗, { 名: "大图", 关: 藏, 叉全关: false, 无返回钮: true });
        压了 = true;
      }
    }
    显(起号 || 0);
    窗.querySelector(".看图-关").focus({ preventScroll: true });
  }
  function 取址(el) {
    var v = el.getAttribute("data-看图");
    if (v)
      return v;
    if (el.tagName === "A")
      return el.href;
    return el.currentSrc || el.src || "";
  }
  function 取名(el) {
    return el.getAttribute("data-看图名") || el.getAttribute("alt") || el.getAttribute("title") || "";
  }
  document.addEventListener("click", function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey)
      return;
    var el = e.target.closest && e.target.closest("[data-看图]");
    if (!el || 窗 && 窗.contains(el))
      return;
    var 址 = 取址(el);
    if (!址)
      return;
    e.preventDefault();
    e.stopPropagation();
    var 圈 = el.closest("[data-看图组]");
    var 们 = 圈 ? Array.prototype.slice.call(圈.querySelectorAll("[data-看图]")) : [el];
    if (们.indexOf(el) < 0)
      们 = [el];
    开(们.map(function(g) {
      return { src: 取址(g), 名: 取名(g) };
    }), 们.indexOf(el));
  }, true);
  window.UI看图 = { 开, 关: 退出 };
})();
(function() {
  if (window.UI手机表)
    return;
  var 窄 = window.matchMedia ? matchMedia("(max-width:640px)") : null;
  function 头字(th) {
    return (th.textContent || "").replace(/[↕▲▼▾▴✎⧉ⓘ]/g, "").replace(/\s+/g, " ").trim();
  }
  function 末头行(表) {
    return 表 && 表.tHead && 表.tHead.rows.length ? 表.tHead.rows[表.tHead.rows.length - 1].cells : [];
  }
  function 元(tag, cls, 字) {
    var e = document.createElement(tag);
    if (cls)
      e.className = cls;
    if (字 != null)
      e.textContent = 字;
    return e;
  }
  function 卡片(表, 角色) {
    if (!表 || !表.tBodies[0])
      return;
    角色 = 角色 || {};
    表.classList.add("机卡表");
    var 外 = 表.closest(".表框, .tablewrap, .scroll, .tscroll, .tblwrap");
    if (外)
      外.classList.add("机卡框");
    if (!表._勾条) {
      表._勾条 = true;
      表.addEventListener("click", function(e) {
        if (表.classList.contains("机看表") || !(窄 && 窄.matches))
          return;
        var td = e.target.closest && e.target.closest("td.勾列, td.ckcol");
        if (!td || td.parentNode.parentNode !== 表.tBodies[0])
          return;
        var 框 = td.querySelector("input[type=checkbox], [role=checkbox]");
        if (!框 || 框.contains(e.target) || e.target.closest("label"))
          return;
        e.stopPropagation();
        if (!框.disabled && 框.getAttribute("aria-disabled") !== "true")
          框.click();
      }, true);
    }
    var 头行 = 末头行(表), 键 = [], 字 = [];
    [].forEach.call(头行, function(th) {
      var t = 头字(th);
      键.push(th.dataset.列 || th.dataset.field || t);
      字.push(t);
    });
    var 角 = {}, 上限 = 角色.数上限 || 3;
    ["号", "态", "图", "名", "数", "注", "钮"].forEach(function(r) {
      [].concat(角色[r] || []).forEach(function(k) {
        if (!(k in 角))
          角[k] = r;
      });
    });
    var 有 = function(r) {
      return 键.some(function(k) {
        return 角[k] === r;
      });
    };
    var 猜 = function(r, re) {
      if (有(r))
        return;
      for (var i = 0;i < 键.length; i++) {
        if (!角[键[i]] && re.test(字[i])) {
          角[键[i]] = r;
          return;
        }
      }
    };
    猜("号", /(^ID$|号$)/i);
    猜("态", /^状态$/);
    猜("图", /^(主图|图|缩略图)$/);
    猜("名", /名称|标题|关键词/);
    猜("名", /^(?!排名$).*名$/);
    if (!有("数")) {
      var n = 0;
      for (var i = 0;i < 键.length && n < 上限; i++)
        if (!角[键[i]] && 头行[i] && 头行[i].matches(".数, .num")) {
          角[键[i]] = "数";
          n++;
        }
    }
    [].forEach.call(表.tBodies[0].rows, function(tr) {
      var 数 = 0;
      tr.classList.toggle("机卡勾", !!tr.querySelector(":scope > td.勾列, :scope > td.ckcol"));
      [].forEach.call(tr.cells, function(td, i) {
        if (td.colSpan > 1)
          return;
        var r = 角色.按位 ? 角色.按位[i] : 角[键[i]];
        if (r === "数" && ++数 > 上限)
          r = null;
        if (r === "钮") {
          var 控 = td.querySelectorAll("button, a[href], select, input");
          r = !控.length ? null : 控.length > 1 || td.querySelector("select") ? "注" : "钮";
        }
        if (r) {
          td.dataset.卡 = r;
          if (r === "数")
            td.dataset.l = 字[i] || "";
        } else if (td.dataset.卡)
          delete td.dataset.卡;
      });
    });
  }
  function 看表钮(表们, 键) {
    var b = 元("button", "次钮");
    b.type = "button";
    b.title = "看成表格 = 横着滑看原来那张表,全部列都在,格子里能改;再点一下回到卡片。本机记住";
    var 读 = function() {
      try {
        return localStorage.getItem("看表:" + 键) === "1";
      } catch (e) {
        return false;
      }
    };
    var 套 = function(on) {
      表们().forEach(function(t) {
        if (t)
          t.classList.toggle("机看表", on);
      });
      b.textContent = on ? "▦ 看成卡片" : "▤ 看成表格";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    };
    b.addEventListener("click", function() {
      var on = !读();
      try {
        localStorage.setItem("看表:" + 键, on ? "1" : "0");
      } catch (e) {}
      套(on);
      表们().forEach(function(t) {
        if (t)
          t.dispatchEvent(new CustomEvent("机看表", { bubbles: true, detail: { 看表: on } }));
      });
    });
    b._套 = function() {
      套(读());
    };
    b._套();
    return b;
  }
  var 盖层 = ".弹窗遮幕:not([hidden]), dialog[open], .确认幕, .mask.open, .mask.show, .ovl.open, .ovl.show";
  function 工具(条, 设) {
    if (!条)
      return { 刷: function() {}, 关: function() {} };
    if (条._手机工具)
      return 条._手机工具;
    设 = 设 || {};
    var 表们 = function() {
      var t = typeof 设.表 === "function" ? 设.表() : 设.表;
      return [].concat(t || []).filter(Boolean);
    };
    var 留 = function(el) {
      return el.matches(".搜, .search, [data-手机留], input[type=search]") || !!el.querySelector("input[type=search]") || el.matches("button, a") && /^\s*＋/.test(el.textContent || "");
    };
    var 钮 = 元("button", "次钮 机工具钮");
    钮.type = "button";
    钮.setAttribute("aria-expanded", "false");
    钮.title = "筛选、列、视图、导出和这张表自己的钮都在这里,点开从底下升起来;手机上表头收了,排序也在里面换。N = 现在生效的筛选条数";
    var 层 = 元("div", "机工具层");
    层.hidden = true;
    var 幕 = 元("div", "机工具幕");
    var 抽 = 元("div", "机工具抽屉");
    抽.setAttribute("role", "dialog");
    抽.setAttribute("aria-modal", "true");
    抽.setAttribute("aria-label", "筛选与工具");
    var 头 = 元("div", "机工具抽屉头");
    头.appendChild(元("b", "", "筛选与工具"));
    var 收钮 = 元("button", "次钮", "✗ 收起");
    收钮.type = "button";
    头.appendChild(收钮);
    var 身 = 元("div", "机工具抽屉身"), 尾 = 元("div", "机工具抽屉尾");
    抽.append(头, 身, 尾);
    层.append(幕, 抽);
    var 排 = 元("label", "工具排");
    排.title = "手机上表头收起来了,排序在这儿换";
    var 排选 = 元("select", "输入");
    排.append(元("span", "", "排序"), 排选);
    var 全 = 元("button", "次钮");
    全.type = "button";
    全.title = "勾上 / 取消屏上这些行";
    var 看 = 设.键 ? 看表钮(表们, 设.键) : null;
    尾.append(排, 全);
    if (看)
      尾.appendChild(看);
    var 可排头 = function() {
      var t = 表们()[0];
      return [].filter.call(末头行(t), function(th) {
        return th.classList.contains("可排");
      });
    };
    var 排序 = 设.排序 || {
      项: function() {
        return 可排头().map(function(th, i) {
          return { f: String(i), 名: 头字(th) };
        });
      },
      取: function() {
        var r = {};
        可排头().forEach(function(th, i) {
          var a = th.getAttribute("aria-sort");
          if (a === "ascending" || a === "descending")
            r = { field: String(i), dir: a === "ascending" ? 1 : -1 };
        });
        return r;
      },
      设: function(f, dir) {
        var 要 = dir === 1 ? "ascending" : "descending";
        for (var k = 0;k < 3; k++) {
          var th = 可排头()[+f];
          if (!th || th.getAttribute("aria-sort") === 要)
            break;
          th.click();
        }
      }
    };
    排选.addEventListener("change", function() {
      var v = 排选.value;
      if (!v)
        return;
      var i = v.lastIndexOf("|");
      排序.设(v.slice(0, i), +v.slice(i + 1));
      柄.刷();
    });
    var 全勾 = function() {
      var t = 表们()[0];
      return t && t.tHead ? t.tHead.querySelector("input[type=checkbox], [role=checkbox]") : null;
    };
    var 勾上 = function(c) {
      return c.matches("input[type=checkbox]") ? c.checked : c.getAttribute("aria-checked") === "true";
    };
    var 点不了 = function(c) {
      return c.matches("input[type=checkbox]") ? c.disabled : c.getAttribute("aria-disabled") === "true";
    };
    全.addEventListener("click", function() {
      var c = 全勾();
      if (c && !点不了(c))
        c.click();
      柄.刷();
    });
    function 标留() {
      var 末 = null;
      [].forEach.call(条.children, function(el) {
        if (el === 钮 || el === 层)
          return;
        var 是 = 留(el);
        el.classList.toggle("机工具留", 是);
        if (是)
          末 = el;
      });
      var 该前 = 末 ? 末.nextSibling : 条.firstChild;
      if (钮.parentNode !== 条 || 钮 !== 该前 && 钮.previousElementSibling !== 末)
        条.insertBefore(钮, 该前);
    }
    var 搬走 = [], 深 = 0;
    function 开着() {
      return !层.hidden;
    }
    function 外们() {
      var 列 = [];
      try {
        var r = 设.外 ? 设.外() : null;
        列 = !r ? [] : r.nodeType ? [r] : [].slice.call(r);
      } catch (e) {
        列 = [];
      }
      return 列.filter(function(el) {
        return el && el.nodeType === 1 && el.parentNode && el !== 钮 && !el.contains(层) && !层.contains(el);
      });
    }
    function 开() {
      if (开着())
        return;
      标留();
      搬走 = [];
      [].slice.call(条.children).forEach(function(el) {
        if (el === 钮 || el === 层 || el.classList.contains("机工具留"))
          return;
        var 位 = document.createComment("筛选与工具");
        el.before(位);
        身.appendChild(el);
        搬走.push({ e: el, 位 });
      });
      外们().forEach(function(el) {
        if (搬走.some(function(x) {
          return x.e === el;
        }))
          return;
        var 位 = document.createComment("筛选与工具");
        el.before(位);
        身.appendChild(el);
        搬走.push({ e: el, 位, 外: true });
      });
      层.hidden = false;
      条.classList.add("开");
      钮.setAttribute("aria-expanded", "true");
      深 = window.UI叠层 ? UI叠层.压(层, { 名: "筛选与工具", 关: 藏, 钮位: ".机工具抽屉头" }) : 0;
      柄.刷();
      收钮.focus({ preventScroll: true });
    }
    function 藏() {
      if (!开着())
        return;
      搬走.forEach(function(x) {
        if (x.位.parentNode)
          x.位.replaceWith(x.e);
        else if (!x.外)
          条.appendChild(x.e);
        else if (x.e.parentNode === 身)
          x.e.remove();
      });
      搬走 = [];
      层.hidden = true;
      条.classList.remove("开");
      钮.setAttribute("aria-expanded", "false");
      柄.刷();
    }
    function 收() {
      if (!开着())
        return;
      if (window.UI叠层 && UI叠层.顶() === 层)
        UI叠层.退();
      else
        藏();
    }
    钮.addEventListener("click", function(e) {
      e.stopPropagation();
      if (开着())
        收();
      else
        开();
    });
    幕.addEventListener("click", 收);
    收钮.addEventListener("click", 收);
    身.addEventListener("click", function() {
      setTimeout(function() {
        if (!开着())
          return;
        if (window.UI叠层 && UI叠层.深度() > 深)
          return;
        var 盖 = document.querySelector(盖层);
        if (盖 && !层.contains(盖))
          收();
      }, 0);
    });
    if (!window.UI叠层)
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && 开着() && !document.querySelector(盖层))
          收();
      });
    if (窄 && 窄.addEventListener)
      窄.addEventListener("change", function(e) {
        if (!e.matches)
          收();
      });
    条.appendChild(层);
    条.classList.add("机收工具");
    var 柄 = {
      刷: function() {
        var n = 0;
        try {
          n = 设.筛数 ? 设.筛数() || 0 : 0;
        } catch (e) {
          n = 0;
        }
        钮.textContent = "筛选与工具 · " + n + (开着() ? " ▴" : " ▾");
        if (!开着())
          标留();
        var 项 = 排序.项() || [], 现 = 排序.取() || {};
        排.hidden = !项.length;
        排选.textContent = "";
        if (!现.field)
          排选.appendChild(new Option("默认顺序", ""));
        项.forEach(function(c) {
          [1, -1].forEach(function(d) {
            var o = new Option(c.名 + (d === -1 ? " ↓ 大到小" : " ↑ 小到大"), c.f + "|" + d);
            if (String(现.field) === String(c.f) && 现.dir === d)
              o.selected = true;
            排选.appendChild(o);
          });
        });
        var c = 全勾();
        全.hidden = !c;
        if (c) {
          全.textContent = 勾上(c) ? "取消全选" : "全选";
          全.disabled = 点不了(c);
        }
        if (看)
          看._套();
      },
      关: 收,
      层
    };
    条._手机工具 = 柄;
    柄.刷();
    return 柄;
  }
  window.UI手机表 = { 卡片, 工具, 看表钮 };
})();

const 参 = new URLSearchParams(location.search);
const 桌面 = 参.get("桌面") === "1";
const 角色 = "恶魔", 图目录 = `小人/${encodeURIComponent(角色)}/`;
document.documentElement.style.setProperty("--站图", `url('${图目录}站.png')`);
const $ = (id) => document.getElementById(id);
function 造错(句, 原文) {
  return Object.assign(new Error(原文 || 句), { 句, 原文: 原文 || 句 });
}
async function 问(体) {
  let r;
  try {
    r = await fetch("/api/move", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(体) });
  } catch (e) {
    throw 造错("待办服务连不上", `POST /api/move ${体.op}:${e && e.message || e}`);
  }
  let j = null;
  try {
    j = await r.json();
  } catch {}
  if (!j)
    throw 造错("服务回话看不懂", `POST /api/move ${体.op} → HTTP ${r.status}`);
  if (!j.ok)
    throw 造错(j.error || "没办成", `POST /api/move ${体.op} → HTTP ${r.status}:${j.原文 || j.error}`);
  return j;
}
function 报错整段(e, 位置) {
  const 时 = new Date;
  const 号 = "运动-" + 时.toISOString().replace(/\D/g, "").slice(0, 14);
  return [
    e.句 || "出错了",
    `原始报错:${e.原文 || e.message || e}`,
    `位置:${位置} ${location.pathname}${location.search}`,
    `时间:${时.toLocaleString("zh-CN", { hour12: false })}`,
    `错误号:${号}`
  ].join(`
`);
}
async function 复制(文, 钮) {
  try {
    await navigator.clipboard.writeText(文);
  } catch {
    const t = document.createElement("textarea");
    t.value = 文;
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
    } finally {
      t.remove();
    }
  }
  const 原 = 钮.textContent;
  钮.textContent = "✓ 已复制";
  setTimeout(() => {
    钮.textContent = 原;
  }, 1500);
}
const 转义 = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const 线 = (pts, 类 = "人") => `<polyline class="${类}" points="${pts}"/>`;
const 手位 = {
  膝: "100,72 120,98 142,115",
  肚: "100,72 104,92 116,100",
  背: "100,72 90,92 88,108",
  腿侧: "100,72 104,96 110,112",
  胫: "100,72 125,100 146,135",
  前: "100,72 122,86 140,84",
  站垂: "110,68 117,95 119,118",
  站腰: "110,68 100,90 104,112"
};
function 坐人(手, 动) {
  const 节 = 动.节;
  const 上身动 = { pelvic_tilt: `摇 ${节}s ease-in-out infinite`, seated_twist: `转体 ${节}s ease-in-out infinite` }[动.animation] || "";
  const 手动 = { back_rub: "上下 1s ease-in-out infinite", thigh_tap: "敲 .9s ease-in-out infinite", belly_circle: `画圈 ${节}s linear infinite` }[动.animation] || "";
  const 肚动 = ["belly_breath", "breath_lift"].includes(动.animation) ? `呼吸 ${节}s ease-in-out infinite` : "";
  return `<svg viewBox="0 0 220 200" aria-hidden="true">
    ${线("70,70 70,128 140,128", "椅")}${线("75,128 75,185", "椅")}${线("135,128 135,185", "椅")}
    <g style="transform-origin:100px 122px;animation:${上身动}">
      <ellipse class="肚" cx="108" cy="100" rx="5" ry="12" style="transform-origin:103px 100px;animation:${肚动}"/>
      ${线("100,122 100,62")}<circle class="头像" cx="100" cy="46" r="13"/>
      <g style="animation:${手动}">${线(手)}</g>
    </g>
    ${线("100,122 148,122 148,175")}
    <g style="transform-origin:148px 175px;animation:${动.animation === "ankle_circle" ? "转脚 2s linear infinite" : ""}">${线("148,175 165,175")}</g>
    ${动.animation === "breath_lift" ? `<path class="箭" d="M108 132 V116 M102 122 L108 116 L114 122" style="animation:上提 ${节}s ease-out infinite"/>` : ""}
    ${动.animation === "acupoint_press" ? `<circle class="点" cx="153" cy="138" r="5" style="transform-origin:153px 138px;animation:按 1.5s ease-in-out infinite"/>` : ""}
  </svg>`;
}
function 站人(手, 动) {
  const 节 = 动.节;
  const 踏 = 动.animation === "march";
  return `<svg viewBox="0 0 220 200" aria-hidden="true">
    <g style="transform-origin:110px 120px;animation:${动.animation === "standing_backbend" ? `后仰 ${节}s ease-in-out infinite` : ""}">
      ${线("110,120 110,60")}<circle class="头像" cx="110" cy="44" r="13"/>${线(手)}
    </g>
    ${动.animation === "glute_squeeze" ? `<ellipse class="亮" cx="102" cy="124" rx="8" ry="10" style="animation:夹 ${节}s linear infinite"/>` : ""}
    <g style="transform-origin:110px 120px;animation:${踏 ? "踏左 1.2s ease-in-out infinite" : ""}">${线("110,120 105,185")}</g>
    <g style="transform-origin:110px 120px;animation:${踏 ? "踏右 1.2s ease-in-out infinite" : ""}">${线("110,120 115,185")}</g>
  </svg>`;
}
let 小人图 = {};
const 小人图到 = fetch(图目录 + "图.json").then((r) => r.ok ? r.json() : {}).catch(() => ({})).then((j) => 小人图 = j);
async function 取小人图(id) {
  await 小人图到;
  return 小人图[id] || null;
}
const 夹秒 = 5;
const 分段 = { belly_breath: 4, glute_squeeze: 夹秒, breath_lift: (动) => 动.hold_seconds };
const 转秒 = 2, 停呼吸 = 3;
function 转体帧(动, 图, 秒) {
  const 边 = 动.seconds_per_rep, t = 秒 % (边 * 2), s = t % 边, 圈 = 图.圈 || 图.帧, q = 圈 / 4, 左 = t >= 边, 起 = 左 ? 2 * q : 0;
  if (图.段) {
    const [转, 停, 回] = 图.段, 头 = 左 ? 转 + 停 + 回 : 0;
    if (s < 转秒)
      return 头 + Math.min(转 - 1, Math.floor(s / 转秒 * 转));
    if (s < 边 - 转秒) {
      const u = (s - 转秒) / (边 - 2 * 转秒) * 停呼吸, f = u % 1;
      return 头 + 转 + Math.min(停 - 1, Math.floor((Math.floor(u) % 2 ? 1 - f : f) * 停));
    }
    return 头 + 转 + 停 + Math.min(回 - 1, Math.floor((s - 边 + 转秒) / 转秒 * 回));
  }
  if (s >= 转秒 && s < 边 - 转秒 && 图.停) {
    const 列 = 图.停[左 ? 1 : 0], 晃 = (1 - Math.cos(2 * Math.PI * 停呼吸 * (s - 转秒) / (边 - 2 * 转秒))) / 2;
    return 列[Math.round((1 - 晃) * (列.length - 1))];
  }
  const i = s < 转秒 ? 起 + s / 转秒 * q : s < 边 - 转秒 ? 起 + q : 起 + q + (s - 边 + 转秒) / 转秒 * q;
  return Math.min(圈 - 1, Math.floor(i));
}
function 小人帧(动, 图, 秒) {
  if (动.animation === "seated_twist")
    return 转体帧(动, 图, 秒);
  const 分 = 分段[动.animation], 段 = typeof 分 === "function" ? 分(动) : 分, 周 = 段 ? 动.seconds_per_rep : 图.帧 / (图.帧率 || 12), t = 秒 % 周;
  const i = 段 ? t < 段 ? t / 段 * 图.吸满帧 : 图.吸满帧 + (t - 段) / (周 - 段) * (图.帧 - 图.吸满帧) : t / 周 * 图.帧;
  return Math.min(图.帧 - 1, Math.floor(i));
}
const 帧库 = new Map;
const 收帧 = (承) => 承.then((帧们) => 帧们.forEach((b) => b.close()), () => {});
let 切帧工 = null, 切帧号 = 0;
const 等切 = new Map;
function 后台切(参) {
  return new Promise((好, 坏) => {
    if (!切帧工) {
      切帧工 = new Worker("小人切帧.js");
      切帧工.onmessage = (e) => {
        const 等 = 等切.get(e.data.号);
        等切.delete(e.data.号);
        if (等)
          e.data.错 ? 等.坏(new Error(e.data.错)) : 等.好(e.data.帧们);
      };
      切帧工.onerror = (e) => {
        for (const 等 of 等切.values())
          等.坏(new Error(e.message || "后台线程起不来"));
        等切.clear();
        切帧工 = null;
      };
    }
    const 号 = ++切帧号;
    等切.set(号, { 好, 坏 });
    切帧工.postMessage({ 号, ...参 });
  });
}
async function 本线程切({ 址们, 每页, 帧, 宽, 高, 列, 出宽, 出高 }) {
  const 缩 = 出高 < 高 ? { resizeWidth: 出宽, resizeHeight: 出高, resizeQuality: "high" } : {}, 帧们 = [];
  for (let k = 0;k < 址们.length; k++) {
    const r = await fetch(址们[k], { credentials: "same-origin" });
    if (!r.ok)
      throw new Error(`取 ${址们[k]} → HTTP ${r.status}`);
    const 大 = await createImageBitmap(await r.blob()), n = Math.min(每页, 帧 - k * 每页);
    帧们.push(...await Promise.all(Array.from({ length: n }, (_, i) => createImageBitmap(大, i % 列 * 宽, Math.floor(i / 列) * 高, 宽, 高, 缩))));
    大.close();
  }
  return 帧们;
}
function 精灵址(id, 页 = 1) {
  return new URL(`${图目录}${encodeURIComponent(页 > 1 ? `${id}-${页}` : id)}.webp`, location.href).href;
}
function 要高(图) {
  const 格 = $("台").querySelector(".真人"), 原 = 图.高 || 图.边;
  return 格 && 格.clientHeight ? Math.min(原, Math.ceil(格.clientHeight * (devicePixelRatio || 1) / 128) * 128) : 原;
}
function 切帧(id, 图, 至少 = 0) {
  const 有 = 帧库.get(id);
  if (有 && 有.高 >= 至少)
    return 有.承;
  const 宽 = 图.宽 || 图.边, 高 = 图.高 || 图.边, 出高 = Math.max(至少, 要高(图));
  const 参 = { 址们: Array.from({ length: 图.页 || 1 }, (_, k) => 精灵址(id, k + 1)), 每页: 图.每页 || 图.帧, 帧: 图.帧, 宽, 高, 列: 图.列, 出宽: Math.round(出高 * 宽 / 高), 出高 };
  const 承 = 后台切(参).catch((e) => {
    console.warn("小人后台切帧没成,改在本线程切", e);
    return 本线程切(参);
  });
  承.catch(() => {
    if (帧库.get(id) && 帧库.get(id).承 === 承)
      帧库.delete(id);
  });
  if (有)
    承.then(() => 有.承.then((旧) => {
      const 格 = $("台").querySelector(".真人");
      if (!格 || 格.帧们 !== 旧)
        旧.forEach((b) => b.close());
    }), () => {});
  帧库.set(id, { 高: 出高, 承 });
  return 承;
}
function 只留帧(...留) {
  for (const [id, 有] of 帧库)
    if (!留.includes(id)) {
      帧库.delete(id);
      收帧(有.承);
    }
}
function 画帧(格, i) {
  const 布 = 格.querySelector("canvas"), r = devicePixelRatio || 1;
  const w = Math.round(格.clientWidth * r), h = Math.round(格.clientHeight * r), 记 = `${w}×${h} ${i}`;
  if (布.记 === 记)
    return;
  布.记 = 记;
  if (布.width !== w || 布.height !== h) {
    布.width = w;
    布.height = h;
  }
  const 笔 = 布.getContext("2d");
  笔.imageSmoothingQuality = "high";
  笔.clearRect(0, 0, w, h);
  笔.drawImage(格.帧们[i], 0, 0, w, h);
  格.dataset.帧 = i;
}
function 摆小人帧() {
  const 格 = $("台").querySelector(".真人"), 动 = 播.组 && 播.组.动作[播.序];
  const 秒 = 动 ? 播.已秒 + (播.停 || 播.收了 ? 0 : (performance.now() - 上拍) / 1000) : 0;
  if (格 && 格.帧们 && 动 && 小人图[动.id]) {
    画帧(格, 小人帧(动, 小人图[动.id], 秒));
    const 图 = 小人图[动.id], 布 = 格.querySelector("canvas"), 现 = 格.帧们[0].height;
    if (!格.重切 && 布.height > 现 * 1.1 && 现 < (图.高 || 图.边)) {
      格.重切 = true;
      const 旧 = 格.帧们;
      切帧(动.id, 图, 要高(图)).then((新) => {
        格.重切 = false;
        if (格.帧们 === 旧 && 新 !== 旧) {
          格.帧们 = 新;
          布.记 = "";
          旧.forEach((b) => b.close());
        }
      }, () => {});
    }
  }
  if (动 && !播.停 && !播.收了) {
    const 字 = 拍字(动, 秒);
    if ($("拍").textContent !== 字)
      $("拍").textContent = 字;
  }
  if (动 && 动.animation === "glute_squeeze") {
    const t = 秒 % 动.seconds_per_rep, 力 = t < 夹秒 ? t / 夹秒 : 1 - (t - 夹秒) / (动.seconds_per_rep - 夹秒);
    $("息").firstChild.style.width = 力 * 100 + "%";
    const 光 = 格 && 格.querySelector(".臀光");
    if (光)
      光.style.opacity = 力.toFixed(3);
  }
  requestAnimationFrame(摆小人帧);
}
function 画小人(动) {
  const 手 = {
    belly_breath: 手位.肚,
    breath_lift: 手位.肚,
    belly_circle: 手位.肚,
    back_rub: 手位.背,
    thigh_tap: 手位.腿侧,
    acupoint_press: 手位.胫,
    seated_twist: 手位.前,
    standing_backbend: 手位.站腰
  }[动.animation];
  if (动.category === "standing")
    return 站人(手 || 手位.站垂, 动);
  return 坐人(手 || 手位.膝, 动);
}
const 播 = { 组: null, 序: 0, 已秒: 0, 停: false, 做完: 0, 跳过: 0, 总秒: 0, 开始: Date.now(), 收了: false, 等记: null };
function 动作总秒(动) {
  return 动.mode === "timer" ? 动.seconds : 动.reps * 动.seconds_per_rep;
}
function 秒字(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function 换动作() {
  const 动 = 播.组.动作[播.序];
  动.节 = 动.mode === "timer" ? 2 : 动.seconds_per_rep;
  $("组题").textContent = `${播.组.名称} · 第 ${播.序 + 1} / ${播.组.动作.length} 个`;
  $("动作名").textContent = 动.名称;
  $("要领").textContent = 动.tip;
  if (桌面)
    $("动作名").title = `${$("组题").textContent}
${动.tip}`;
  $("台").innerHTML = 画小人(动);
  只留帧(动.id, 播.组.动作[播.序 + 1] && 播.组.动作[播.序 + 1].id);
  取小人图(动.id).then((图) => {
    if (!图 || 播.组.动作[播.序] !== 动)
      return;
    $("台").innerHTML = `<div class="真人" role="img" aria-label="${转义(动.名称)}示范" style="--宽比:${(图.宽 || 图.边) / (图.高 || 图.边)}" data-图="${精灵址(动.id)}"><canvas></canvas>${图.臀 ? 臀光(图.臀) : ""}</div>`;
    const 格 = $("台").querySelector(".真人");
    切帧(动.id, 图).then((帧们) => {
      格.帧们 = 帧们;
      预载下一个();
    }, (e) => console.warn(`${动.id} 小人图没解开,只放字幕`, e));
  });
  $("息").hidden = 动.animation !== "glute_squeeze";
  播.已秒 = 0;
  刷进度();
}
function 预载下一个() {
  const 下 = 播.组.动作[播.序 + 1];
  if (下)
    取小人图(下.id).then((图) => {
      if (图 && 播.组.动作[播.序 + 1] === 下)
        切帧(下.id, 图).catch(() => {});
    });
}
function 臀光([x0, y0, x1, y1]) {
  const 位 = `left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%`;
  return `<svg class="臀光" style="${位}" viewBox="286 572 238 160" preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id="臀色" cx="45%" cy="45%" r="55%"><stop offset="0" stop-color="#ff8a50" stop-opacity=".9"/><stop offset=".6" stop-color="#ff5a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff3a1a" stop-opacity="0"/></radialGradient>
      <filter id="臀软" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
      <clipPath id="臀左"><ellipse cx="350" cy="650" rx="58" ry="70" transform="rotate(-12 350 650)"/></clipPath>
      <clipPath id="臀右"><ellipse cx="452" cy="652" rx="66" ry="72" transform="rotate(10 452 652)"/></clipPath></defs>
    <g filter="url(#臀软)"><ellipse cx="350" cy="650" rx="64" ry="78" transform="rotate(-12 350 650)" fill="url(#臀色)"/><ellipse cx="452" cy="652" rx="72" ry="80" transform="rotate(10 452 652)" fill="url(#臀色)"/></g>
    <g stroke="#ffe0c8" stroke-opacity=".7" stroke-width="5" fill="none" stroke-linecap="round">
      <g clip-path="url(#臀左)"><path d="M300 600 Q340 640 330 720 M330 588 Q370 640 362 725 M362 588 Q400 640 396 715"/></g>
      <g clip-path="url(#臀右)"><path d="M408 600 Q430 640 428 710 M440 588 Q475 640 462 726 M474 592 Q508 640 494 720"/></g></g>
  </svg>`;
}
function 拍字(动, 秒) {
  if (动.hold_seconds) {
    const t = 秒 % 动.seconds_per_rep;
    return t < 动.hold_seconds ? `呼气 · 收紧 ${动.hold_seconds} 秒` : "吸气 · 放松";
  }
  if (动.animation === "belly_breath") {
    const t = 秒 % 动.seconds_per_rep;
    return t < 4 ? "吸气 4 秒 · 肚子鼓" : "呼气 6 秒 · 肚子收";
  }
  if (动.animation === "seated_twist" && 小人图[动.id]) {
    const 边 = 动.seconds_per_rep, s = 秒 % 边, 向 = 秒 % (边 * 2) < 边 ? "右" : "左";
    return s < 转秒 ? `向${向}转身` : s < 边 - 转秒 ? "停住 · 慢慢呼吸 3 次" : "转回正面";
  }
  if (动.animation === "glute_squeeze")
    return 秒 % 动.seconds_per_rep < 夹秒 ? `吸气 · 夹紧 ${夹秒} 秒` : "呼气 · 放松";
  return "";
}
function 刷进度() {
  const 动 = 播.组.动作[播.序];
  const 总 = 动作总秒(动);
  $("条").style.width = Math.min(100, 播.已秒 / 总 * 100) + "%";
  if (动.mode === "timer")
    $("数").textContent = `剩 ${秒字(总 - 播.已秒)}`;
  else {
    const 第 = Math.min(动.reps, Math.floor(播.已秒 / 动.seconds_per_rep) + 1);
    $("数").textContent = `第 ${第} / ${动.reps} ${动.rep_unit || "次"}`;
  }
  $("拍").innerHTML = 播.停 ? '<span class="暂停字">⏸ 已暂停</span>' : 转义(拍字(动, 播.已秒));
}
function 下一个(做完了) {
  if (做完了)
    播.做完 += 1;
  else
    播.跳过 += 1;
  if (播.序 + 1 >= 播.组.动作.length)
    return 收尾(播.做完 === 播.组.动作.length ? "完成" : "部分");
  播.序 += 1;
  换动作();
}
function 设停(停) {
  播.停 = 停;
  document.body.classList.toggle("停", 停);
  $("暂停钮").textContent = 停 ? "▶ 继续" : "⏸ 暂停";
  刷进度();
}
let 上拍 = performance.now();
function 走() {
  const 现 = performance.now();
  const 差 = (现 - 上拍) / 1000;
  上拍 = 现;
  if (播.组 && !播.停 && !播.收了) {
    播.已秒 += 差;
    if (播.已秒 >= 动作总秒(播.组.动作[播.序]))
      下一个(true);
    else
      刷进度();
  }
}
async function 收尾(结果) {
  播.收了 = true;
  $("确认结束").hidden = true;
  $("播放区").hidden = true;
  播.等记 = {
    op: "记",
    场景: 播.组.id,
    槽: 参.get("槽") || "",
    结果,
    做了几个: 播.做完,
    共几个: 播.组.动作.length,
    用时秒: Math.round((Date.now() - 播.开始) / 1000)
  };
  await 交打卡();
}
async function 交打卡() {
  $("错区").hidden = true;
  try {
    const j = await 问(播.等记);
    const 秒 = 播.等记.用时秒;
    $("完成字").textContent = 播.等记.结果 === "完成" ? "✓ 完成" : "⚠ 部分完成";
    $("完成字").style.color = 播.等记.结果 === "完成" ? "" : "var(--琥)";
    $("完成说").textContent = `本轮 ${Math.floor(秒 / 60)} 分 ${String(秒 % 60).padStart(2, "0")} 秒 · 做了 ${播.做完}/${播.等记.共几个} 个 · 今天第 ${j.今天第几轮} 轮`;
    $("完成区").hidden = false;
    let 剩 = 5;
    const 数 = () => {
      $("自关说").textContent = `${剩} 秒后自动关闭`;
      if (剩-- <= 0) {
        clearInterval(计);
        关窗();
      }
    };
    const 计 = setInterval(数, 1000);
    数();
    $("关闭钮").onclick = () => {
      clearInterval(计);
      关窗();
    };
  } catch (e) {
    显示错(e, "打卡没存上,点重试", () => 交打卡());
  }
}
function 关窗() {
  window.close();
  setTimeout(() => {
    $("自关说").textContent = "可以关掉这个窗口了";
  }, 300);
}
function 显示错(e, 句, 重试) {
  $("错句").textContent = 句 || e.句 || "出错了";
  $("错区").hidden = false;
  $("重试钮").onclick = 重试;
  $("复制报错钮").onclick = () => 复制(报错整段(Object.assign(e, { 句: 句 || e.句 }), "运动提醒示范页"), $("复制报错钮"));
  $("错关钮").onclick = 关窗;
}
function 摆成桌面() {
  $("下一个钮").after($("结束钮"));
  const 泡 = document.createElement("div"), 区 = $("播放区"), 台 = $("台");
  泡.className = "泡";
  泡.append($("动作名"), 区.querySelector(".进度"), $("拍"), $("息"), 区.querySelector(".底"));
  区.append(泡, 台);
  $("播放区").prepend($("确认结束"));
}
async function 开示范() {
  if (桌面)
    摆成桌面();
  $("示范").hidden = false;
  $("错区").hidden = true;
  try {
    const 库 = await 问({ op: "动作库" });
    const 组 = 库.场景.find((s) => s.id === 参.get("场景"));
    if (!组 || !组.动作.length)
      throw 造错("没找到这组动作", `动作库里没有场景 ${参.get("场景")}`);
    播.组 = 组;
    播.开始 = Date.now();
    document.title = `${组.名称} · 运动提醒`;
    $("播放区").hidden = false;
    换动作();
    setInterval(走, 250);
    requestAnimationFrame(摆小人帧);
  } catch (e) {
    $("播放区").hidden = true;
    $("结束钮").hidden = true;
    显示错(e, e.句 === "没找到这组动作" ? e.句 : `动作没读出来:${e.句}`, () => location.reload());
  }
  $("暂停钮").onclick = () => 设停(!播.停);
  $("下一个钮").onclick = () => 下一个(false);
  let 确认前停着 = false;
  $("结束钮").onclick = () => {
    if (播.收了)
      return 关窗();
    确认前停着 = 播.停;
    设停(true);
    $("确认结束").hidden = false;
  };
  $("继续做钮").onclick = () => {
    $("确认结束").hidden = true;
    设停(确认前停着);
  };
  $("确认结束钮").onclick = () => 收尾("部分");
}
const 果字 = { 完成: "✓ 完成", 部分: "⚠ 部分完成", 跳过: "→ 跳过", 稍后: "⏱ 稍后" };
let 存字计 = null;
function 设错(e) {
  $("设错句").textContent = e.句 || "出错了";
  $("设错").hidden = false;
  $("设复制钮").onclick = () => 复制(报错整段(e, "运动提醒设置页"), $("设复制钮"));
}
function 画设置(j) {
  const s = j.设置;
  $("启用").checked = !!s.enabled;
  $("启用状态").textContent = s.enabled ? "✓ 已启用" : "未启用:不会提醒";
  $("启用状态").className = "状态 " + (s.enabled ? "开" : "关");
  document.body.classList.toggle("关着", !s.enabled);
  const 段 = s.work_hours || [];
  [["段1a", 0, 0], ["段1b", 0, 1], ["段2a", 1, 0], ["段2b", 1, 1]].forEach(([id, i, k]) => {
    $(id).value = (段[i] || [])[k] || "";
  });
  $("开始日").value = s.start_date || "";
  $("周说").textContent = s.start_date ? `第 ${j.第几周} 周 · 呼吸收紧每次停 ${j.保持秒} 秒` : "第一次启用那天算第 1 周";
}
async function 刷下一次() {
  try {
    const j = await 问({ op: "下一次" });
    $("下一次").textContent = !j.开 ? "未启用,不会提醒" : j.该提醒 ? `现在就该做:${j.该提醒.名称}` : j.下次 ? `${j.下次.时间} ${j.下次.名称}` : "今天没有了";
  } catch (e) {
    $("下一次").textContent = "—";
    设错(e);
  }
}
async function 刷今日() {
  try {
    const j = await 问({ op: "今日" });
    if (!j.行.length) {
      $("今日").innerHTML = '<div class="空">今天还没做过。到点会提醒,也可以点上面「现在做一轮」。</div>';
      return;
    }
    $("今日").innerHTML = `<table><thead><tr><th>ID</th><th>时间</th><th>提醒类型</th><th>结果</th><th>做了几个</th></tr></thead><tbody>${j.行.slice().reverse().map((r) => `<tr><td class="id">${+r.id}</td><td>${转义(r.时间)}</td><td>${转义(r.名称)}${r.手动 ? "(手动)" : ""}</td>` + `<td class="果 ${转义(r.结果)}">${果字[r.结果] || 转义(r.结果)}</td><td>${r.共几个 ? `${+r.做了几个}/${+r.共几个}` : "—"}</td></tr>`).join("")}</tbody></table>`;
  } catch (e) {
    设错(e);
  }
}
async function 存(值) {
  $("设错").hidden = true;
  try {
    画设置(await 问({ op: "设置", 值 }));
    $("存字").textContent = "已保存 ✓";
    clearTimeout(存字计);
    存字计 = setTimeout(() => {
      $("存字").textContent = "";
    }, 2000);
    刷下一次();
  } catch (e) {
    设错(e);
    try {
      画设置(await 问({ op: "设置" }));
    } catch {}
  }
}
async function 开设置() {
  $("设置").hidden = false;
  try {
    画设置(await 问({ op: "设置" }));
    const 库 = await 问({ op: "动作库" });
    $("类型表").innerHTML = 库.场景.map((s) => `<li><b>${转义(s.名称)}</b>:${转义(s.规则)}</li>`).join("");
  } catch (e) {
    设错(e);
  }
  刷下一次();
  刷今日();
  $("启用").onchange = () => 存({ enabled: $("启用").checked });
  const 存时段 = () => {
    const 段 = [[$("段1a").value, $("段1b").value], [$("段2a").value, $("段2b").value]].filter((p) => p[0] || p[1]);
    存({ work_hours: 段 });
  };
  ["段1a", "段1b", "段2a", "段2b"].forEach((id) => {
    $(id).onchange = 存时段;
  });
  $("开始日").onchange = () => {
    if ($("开始日").value)
      存({ start_date: $("开始日").value });
  };
  $("现在做钮").onclick = () => {
    const 高 = Math.min(1000, screen.availHeight - 80);
    window.open("运动.html?场景=S1", "_blank", `width=${Math.max(380, Math.round(高 * 0.5))},height=${高}`);
  };
  window.addEventListener("focus", () => {
    刷今日();
    刷下一次();
  });
}
if (参.get("场景"))
  开示范();
else
  开设置();

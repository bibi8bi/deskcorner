import datetime as _dt
import json
import os

import 公用

动作库路径 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "运动", "动作库.json")
结果们 = ("完成", "部分", "跳过", "稍后")
结案 = ("完成", "部分", "跳过")

运动建表 = """
CREATE TABLE IF NOT EXISTS 运动打卡(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    日期     TEXT NOT NULL,
    槽       TEXT NOT NULL,
    场景     TEXT NOT NULL,
    结果     TEXT NOT NULL CHECK(结果 IN ('完成','部分','跳过','稍后')),
    做了几个 INTEGER,
    共几个   INTEGER,
    用时秒   INTEGER,
    时间     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_运动打卡_日期 ON 运动打卡(日期, 时间);
CREATE TABLE IF NOT EXISTS 运动设置(
    键 TEXT PRIMARY KEY,
    值 TEXT NOT NULL
);
"""


def 补运动表(con):
    已有 = bool(con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='运动打卡'").fetchone())
    con.executescript(运动建表)
    return not 已有


def 读动作库():
    with open(动作库路径, encoding="utf-8") as fh:
        return json.load(fh)


def _时分(s):
    h, m = str(s).split(":")
    h, m = int(h), int(m)
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError
    return h, m


def _当天(今天, s):
    h, m = _时分(s)
    return _dt.datetime.combine(今天, _dt.time(h, m))


def 第几周(开始日期, 今天):
    try:
        d = _dt.date.fromisoformat(str(开始日期))
    except (TypeError, ValueError):
        return 1
    return max(1, (今天 - d).days // 7 + 1)


def 保持秒(动作, 周):
    表 = 动作.get("hold_seconds_by_week") or {}
    for 键, 秒 in 表.items():
        if 键.endswith("+"):
            if 周 >= int(键[:-1]):
                return int(秒)
        else:
            a, b = (int(x) for x in 键.split("-"))
            if a <= 周 <= b:
                return int(秒)
    return None


def 算下一次(现在, 记录们, 设置, 库):
    今天 = 现在.date()
    场景表 = {s["id"]: s for s in 库["scenes"]}
    稍后分 = int(设置.get("snooze_minutes") or 10)
    稍后上限 = int(设置.get("max_snooze") or 2)
    定点窗 = _dt.timedelta(minutes=int(设置.get("fixed_window_minutes") or 60))

    已结槽 = {r["槽"] for r in 记录们 if r["结果"] in 结案}
    稍后们 = {}
    for r in 记录们:
        if r["结果"] == "稍后":
            稍后们.setdefault(r["槽"], []).append(r["时间"])

    def 推迟到(槽, 原到点):
        ts = 稍后们.get(槽) or []
        if not ts:
            return 原到点, 0
        return max(原到点, max(ts) + _dt.timedelta(minutes=稍后分)), len(ts)

    候选 = []

    for s in 库["scenes"]:
        tr = s.get("trigger") or {}
        if tr.get("type") != "fixed":
            continue
        for t in tr.get("times") or []:
            原 = _当天(今天, t)
            槽 = f"{s['id']}@{t}"
            if 槽 in 已结槽:
                continue
            到点, n = 推迟到(槽, 原)
            候选.append((到点, 原 + 定点窗 + _dt.timedelta(minutes=稍后分 * n), 槽, s["id"], n))

    段们 = sorted((_当天(今天, a), _当天(今天, b)) for a, b in (设置.get("work_hours") or []))
    段们 = [(a, b) for a, b in 段们 if a < b]
    结案时们 = [r["时间"] for r in 记录们 if r["结果"] in 结案]
    起点 = max(结案时们) if 结案时们 else None
    间隔 = _dt.timedelta(minutes=int(场景表["S1"]["trigger"].get("minutes") or 50))

    def 定时到点(起点):
        for a, b in 段们:
            if 起点 is None or 起点 < a:
                候 = a + 间隔
            elif 起点 <= b:
                候 = 起点 + 间隔
            else:
                continue
            if 候 <= b:
                return 候
            起点 = b
        return None

    候 = 定时到点(起点)
    if 候 is not None:
        槽 = "轮@" + 候.strftime("%H:%M")
        已做轮 = len({r["槽"] for r in 记录们 if r["槽"].startswith("轮@") and r["结果"] in 结案})
        第n = int(场景表.get("S2", {}).get("trigger", {}).get("every_nth") or 0)
        场景id = "S2" if 第n and (已做轮 + 1) % 第n == 0 else "S1"
        到点, n = 推迟到(槽, 候)
        候选.append((到点, None, 槽, 场景id, n))

    def 在段里(t):
        return any(a <= t <= b for a, b in 段们)

    该 = []
    将 = []
    for 到点, 截止, 槽, 场景id, n in 候选:
        if 到点 <= 现在:
            if 截止 is not None and 现在 > 截止:
                continue
            if 截止 is None and not 在段里(现在):
                continue
            该.append((0 if 截止 is not None else 1, 到点, 槽, 场景id, n))
        else:
            将.append((到点, 槽, 场景id))

    def 场景名(i):
        return 场景表[i].get("display_name") or i

    def 约几分(i):
        秒 = sum(_动作秒(_取动作(库, a), 1) for a in 场景表[i]["sequence"])
        return max(1, round(秒 / 60))

    该提醒 = None
    if 该:
        _, 到点, 槽, 场景id, n = sorted(该)[0]
        该提醒 = {"槽": 槽, "场景": 场景id, "名称": 场景名(场景id), "约几分钟": 约几分(场景id),
                "可稍后": n < 稍后上限, "已稍后": n, "稍后分钟": 稍后分}
    下次 = None
    if 将:
        到点, 槽, 场景id = sorted(将)[0]
        下次 = {"时间": 到点.strftime("%H:%M"), "槽": 槽, "场景": 场景id, "名称": 场景名(场景id)}
    return {"该提醒": 该提醒, "下次": 下次}


def _取动作(库, aid):
    for e in 库["exercises"]:
        if e["id"] == aid:
            return e
    raise ValueError(f"动作库里没有 {aid}")


def _动作秒(e, 周):
    if e.get("mode") == "timer":
        return int(e.get("seconds") or 0)
    每次 = int(e.get("seconds_per_rep") or 0)
    保 = 保持秒(e, 周)
    if 保:
        每次 = 保 * 2
    return int(e.get("reps") or 0) * 每次


def 屏上动作(e, 周):
    d = {k: e[k] for k in ("id", "tip", "mode", "animation", "category") if k in e}
    d["名称"] = e.get("display_name") or e.get("name")
    if e.get("mode") == "timer":
        d["seconds"] = int(e.get("seconds") or 0)
    else:
        d["reps"] = int(e.get("reps") or 0)
        d["seconds_per_rep"] = int(e.get("seconds_per_rep") or 0)
        d["rep_unit"] = e.get("rep_unit") or "次"
        保 = 保持秒(e, 周)
        if 保:
            d["hold_seconds"] = 保
            d["seconds_per_rep"] = 保 * 2
    return d


def _有表(con):
    return bool(con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='运动打卡'").fetchone())


def 读设置(con, 库):
    设 = dict(库.get("settings") or {})
    for 键, 值 in con.execute("SELECT 键, 值 FROM 运动设置"):
        try:
            设[键] = json.loads(值)
        except (TypeError, ValueError):
            pass
    return 设


def _校时段(v):
    if not isinstance(v, list) or not v or len(v) > 4:
        raise ValueError("工作时段格式不对")
    出 = []
    for 段 in v:
        if not (isinstance(段, list) and len(段) == 2):
            raise ValueError("工作时段格式不对")
        try:
            a, b = _时分(段[0]), _时分(段[1])
        except (ValueError, AttributeError):
            raise ValueError("时间要写成 09:00 这样") from None
        if a >= b:
            raise ValueError("每段的开始要早于结束")
        出.append(["%02d:%02d" % a, "%02d:%02d" % b])
    return 出


def 存设置(con, 改, 今天):
    if not isinstance(改, dict):
        raise ValueError("设置格式不对")
    存 = {}
    if "enabled" in 改:
        存["enabled"] = bool(改["enabled"])
        if 存["enabled"]:
            已有 = con.execute("SELECT 值 FROM 运动设置 WHERE 键='start_date'").fetchone()
            if not 已有 and "start_date" not in 改:
                存["start_date"] = 今天.isoformat()
    if "work_hours" in 改:
        存["work_hours"] = _校时段(改["work_hours"])
    if "start_date" in 改:
        try:
            存["start_date"] = _dt.date.fromisoformat(str(改["start_date"])).isoformat()
        except ValueError:
            raise ValueError("开始日期要写成 YYYY-MM-DD 这样") from None
    if not 存:
        raise ValueError("没有要存的设置")
    for 键, 值 in 存.items():
        con.execute("INSERT INTO 运动设置(键, 值) VALUES(?, ?) ON CONFLICT(键) DO UPDATE SET 值=excluded.值",
                    (键, json.dumps(值, ensure_ascii=False)))
    con.commit()


def 今日记录(con, 今天):
    rows = con.execute(
        "SELECT id, 槽, 场景, 结果, 做了几个, 共几个, 用时秒, 时间 FROM 运动打卡 WHERE 日期=? ORDER BY 时间, id",
        (今天.isoformat(),)).fetchall()
    出 = []
    for r in rows:
        d = dict(r)
        d["时间dt"] = _dt.datetime.fromisoformat(r["时间"])
        出.append(d)
    return 出


def _排程用(记录们):
    return [{"槽": r["槽"], "场景": r["场景"], "结果": r["结果"], "时间": r["时间dt"]} for r in 记录们]


def 运动接口(d, 现在=None):
    d = d or {}
    op = str(d.get("op") or "下一次").strip()
    现在 = 现在 or _dt.datetime.now().replace(microsecond=0)
    今天 = 现在.date()
    try:
        库 = 读动作库()
    except (OSError, ValueError) as e:
        return {"ok": False, "error": "动作库读不出来", "原文": f"{动作库路径}:{e}"}
    con = 公用.待办连库()
    try:
        if not _有表(con):
            return {"ok": False, "error": "运动提醒的表还没建,请先升级库"}
        设 = 读设置(con, 库)
        场景表 = {s["id"]: s for s in 库["scenes"]}

        if op == "下一次":
            if not 设.get("enabled"):
                return {"ok": True, "开": False, "该提醒": None, "下次": None}
            r = 算下一次(现在, _排程用(今日记录(con, 今天)), 设, 库)
            return {"ok": True, "开": True, **r}

        if op == "记":
            结果 = str(d.get("结果") or "")
            场景 = str(d.get("场景") or "")
            槽 = str(d.get("槽") or "").strip()
            if 结果 not in 结果们:
                return {"ok": False, "error": "结果只认 完成 / 部分 / 跳过 / 稍后"}
            if 场景 not in 场景表:
                return {"ok": False, "error": "没有这个提醒类型"}
            if not 槽:
                槽 = "手动@" + 现在.strftime("%H:%M:%S")
            if len(槽) > 40:
                return {"ok": False, "error": "槽名太长"}
            if 结果 == "稍后":
                n = con.execute("SELECT COUNT(*) FROM 运动打卡 WHERE 日期=? AND 槽=? AND 结果='稍后'",
                                (今天.isoformat(), 槽)).fetchone()[0]
                if n >= int(设.get("max_snooze") or 2):
                    return {"ok": False, "error": f"这次已经推迟 {n} 次了,只能开始或跳过"}

            def 整数(k):
                v = d.get(k)
                if v is None or v == "":
                    return None
                n = int(v)
                if n < 0 or n > 100000:
                    raise ValueError(f"{k} 不对")
                return n
            cur = con.execute(
                "INSERT INTO 运动打卡(日期, 槽, 场景, 结果, 做了几个, 共几个, 用时秒, 时间) VALUES(?,?,?,?,?,?,?,?)",
                (今天.isoformat(), 槽, 场景, 结果, 整数("做了几个"), 整数("共几个"), 整数("用时秒"),
                 现在.isoformat(sep=" ")))
            con.commit()
            今日结案 = con.execute("SELECT COUNT(*) FROM 运动打卡 WHERE 日期=? AND 结果 IN ('完成','部分')",
                               (今天.isoformat(),)).fetchone()[0]
            return {"ok": True, "id": cur.lastrowid, "今天第几轮": 今日结案}

        if op == "今日":
            行们 = []
            for r in 今日记录(con, 今天):
                行们.append({"id": r["id"], "时间": r["时间dt"].strftime("%H:%M"), "场景": r["场景"],
                           "名称": 场景表.get(r["场景"], {}).get("display_name") or r["场景"],
                           "结果": r["结果"], "做了几个": r["做了几个"], "共几个": r["共几个"],
                           "手动": r["槽"].startswith("手动@")})
            return {"ok": True, "行": 行们}

        if op == "设置":
            if "值" in d:
                存设置(con, d.get("值"), 今天)
                设 = 读设置(con, 库)
            周 = 第几周(设.get("start_date"), 今天)
            A2 = next((e for e in 库["exercises"] if e.get("hold_seconds_by_week")), None)
            return {"ok": True, "设置": {k: 设.get(k) for k in ("enabled", "work_hours", "start_date",
                                                               "snooze_minutes", "max_snooze")},
                    "第几周": 周, "保持秒": 保持秒(A2, 周) if A2 else None}

        if op == "动作库":
            周 = 第几周(设.get("start_date"), 今天)
            return {"ok": True, "第几周": 周, "场景": [
                {"id": s["id"], "名称": s.get("display_name") or s["id"], "规则": s.get("rule") or "",
                 "动作": [屏上动作(_取动作(库, a), 周) for a in s["sequence"]]}
                for s in 库["scenes"]]}

        return {"ok": False, "error": "不认识这个操作"}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    finally:
        con.close()

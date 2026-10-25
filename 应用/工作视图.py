import json
import sqlite3

import 公用


视图建表 = """
CREATE TABLE IF NOT EXISTS 待办视图(
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    名称         TEXT NOT NULL COLLATE NOCASE UNIQUE,
    配置         TEXT NOT NULL,
    创建时间     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    最后修改时间 TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_待办视图_改时 ON 待办视图(最后修改时间 DESC, id DESC);
"""


def 补视图表(con):
    已有 = bool(con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='待办视图'").fetchone())
    con.executescript(视图建表)
    return not 已有


def _名称(v):
    s = str(v or "").strip()
    if not s:
        raise ValueError("视图名称不能为空")
    if len(s) > 80:
        raise ValueError("视图名称最多 80 个字")
    return s


def _配置(v):
    if not isinstance(v, dict):
        raise ValueError("视图配置格式不对")
    if int(v.get("schema_version") or 0) != 1:
        raise ValueError("这份视图版本暂时不认识")
    raw = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    if len(raw.encode("utf-8")) > 32768:
        raise ValueError("这份视图条件太多，没保存")
    return raw


def _id(v):
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ValueError("视图编号不对") from None
    if n <= 0:
        raise ValueError("视图编号不对")
    return n


def _一行(r):
    d = {"id": r["id"], "名称": r["名称"], "创建时间": r["创建时间"], "最后修改时间": r["最后修改时间"]}
    try:
        cfg = json.loads(r["配置"])
        if not isinstance(cfg, dict):
            raise ValueError("配置不是对象")
        d["配置"] = cfg
    except (TypeError, ValueError, json.JSONDecodeError):
        d["配置"] = None
        d["失效原因"] = "这份保存视图的配置读不出来，可以删除后重新保存"
    return d


def 工作视图接口(d):
    op = str((d or {}).get("操作") or "列出").strip()
    con = 公用.待办连库()
    try:
        if not con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='待办视图'").fetchone():
            return {"ok": False, "error": "保存视图结构还没准备好，请先完成本次升级"}

        if op == "列出":
            rows = con.execute(
                "SELECT id,名称,配置,创建时间,最后修改时间 FROM 待办视图 "
                "ORDER BY 最后修改时间 DESC,id DESC").fetchall()
            return {"ok": True, "视图": [_一行(r) for r in rows]}

        if op == "新建":
            名 = _名称(d.get("名称"))
            配 = _配置(d.get("配置"))
            try:
                cur = con.execute("INSERT INTO 待办视图(名称,配置) VALUES(?,?)", (名, 配))
                con.commit()
            except sqlite3.IntegrityError:
                return {"ok": False, "error": "已经有同名视图，换个名字或更新原视图"}
            row = con.execute(
                "SELECT id,名称,配置,创建时间,最后修改时间 FROM 待办视图 WHERE id=?", (cur.lastrowid,)).fetchone()
            return {"ok": True, "视图": _一行(row)}

        if op == "更新":
            rid = _id(d.get("id"))
            配 = _配置(d.get("配置"))
            cur = con.execute(
                "UPDATE 待办视图 SET 配置=?,最后修改时间=datetime('now','localtime') WHERE id=?", (配, rid))
            if not cur.rowcount:
                return {"ok": False, "error": "这份视图已经不存在"}
            con.commit()
            row = con.execute(
                "SELECT id,名称,配置,创建时间,最后修改时间 FROM 待办视图 WHERE id=?", (rid,)).fetchone()
            return {"ok": True, "视图": _一行(row)}

        if op == "重命名":
            rid = _id(d.get("id"))
            名 = _名称(d.get("名称"))
            try:
                cur = con.execute(
                    "UPDATE 待办视图 SET 名称=?,最后修改时间=datetime('now','localtime') WHERE id=?", (名, rid))
                if not cur.rowcount:
                    return {"ok": False, "error": "这份视图已经不存在"}
                con.commit()
            except sqlite3.IntegrityError:
                return {"ok": False, "error": "已经有同名视图"}
            row = con.execute(
                "SELECT id,名称,配置,创建时间,最后修改时间 FROM 待办视图 WHERE id=?", (rid,)).fetchone()
            return {"ok": True, "视图": _一行(row)}

        if op == "删除":
            rid = _id(d.get("id"))
            cur = con.execute("DELETE FROM 待办视图 WHERE id=?", (rid,))
            con.commit()
            return {"ok": True, "删除": int(cur.rowcount or 0)}

        return {"ok": False, "error": "不认识这个视图操作"}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    finally:
        con.close()

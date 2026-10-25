import json
import sqlite3

import 公用

默认 = {"关联数据": False, "AI": False}

建表 = """
CREATE TABLE IF NOT EXISTS 功能设置(
    键 TEXT PRIMARY KEY,
    值 TEXT NOT NULL
);
"""


def 补功能设置表(con):
    已有 = bool(con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='功能设置'").fetchone())
    con.executescript(建表)
    return not 已有


def _默认():
    出 = dict(默认)
    try:
        预设 = 公用.读配置().get("功能默认") or {}
    except (OSError, ValueError):
        预设 = {}
    for 键 in 默认:
        if isinstance(预设.get(键), bool):
            出[键] = 预设[键]
    return 出


def 读(con=None):
    出 = _默认()
    自开 = con is None
    try:
        con = con or 公用.待办连库()
        for 键, 值 in con.execute("SELECT 键, 值 FROM 功能设置"):
            if 键 in 出:
                v = json.loads(值)
                if isinstance(v, bool):
                    出[键] = v
    except (sqlite3.Error, OSError, ValueError):
        pass
    finally:
        if 自开 and con is not None:
            con.close()
    return 出


def 功能接口(d):
    d = d or {}
    op = str(d.get("op") or "读").strip()
    if op == "读":
        return {"ok": True, "功能": 读()}
    if op != "存":
        return {"ok": False, "error": f"不认识的操作:{op}"}
    改 = d.get("值")
    if not isinstance(改, dict) or not 改:
        return {"ok": False, "error": "没有要存的开关"}
    for 键, 值 in 改.items():
        if 键 not in 默认:
            return {"ok": False, "error": f"没有这个开关:{键}"}
        if not isinstance(值, bool):
            return {"ok": False, "error": f"「{键}」只收 true / false"}
    con = 公用.待办连库()
    try:
        补功能设置表(con)
        for 键, 值 in 改.items():
            con.execute("INSERT INTO 功能设置(键, 值) VALUES(?, ?) ON CONFLICT(键) DO UPDATE SET 值=excluded.值",
                        (键, json.dumps(值)))
        con.commit()
        return {"ok": True, "功能": 读(con)}
    finally:
        con.close()

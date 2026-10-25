import json
import os
import sqlite3

应用根 = os.path.dirname(os.path.abspath(__file__))
CONFIG路径 = os.path.join(应用根, "config.json")
数据目录 = None


def 读配置():
    with open(CONFIG路径, "r", encoding="utf-8") as f:
        return json.load(f)


def _绝对(p):
    return p if os.path.isabs(p) else os.path.normpath(os.path.join(数据目录 or 应用根, p))


def 待办库路径():
    return _绝对(读配置().get("待办db_path") or "../数据/待办.db")


def 实体库路径(来源):
    p = (读配置().get("实体库") or {}).get(来源)
    return _绝对(p) if p else None


def 待办连库(来源=None, timeout=15):
    p = 待办库路径()
    conn = sqlite3.connect(f"file:{p}?mode=rw", uri=True, timeout=timeout)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    实体 = 实体库路径(来源) if 来源 else None
    if 实体 and os.path.exists(实体):
        try:
            挂实体(conn, 实体)
        except (sqlite3.Error, OSError, ValueError):
            pass
    return conn


def 挂实体(conn, 路径):
    if not 路径.endswith(".json"):
        conn.execute('ATTACH DATABASE ? AS "实体"', (f"file:{路径}?mode=ro",))
        return
    with open(路径, encoding="utf-8") as fh:
        清单 = json.load(fh)
    conn.execute("ATTACH DATABASE ':memory:' AS \"实体\"")
    for 表, 行们 in 清单.items():
        if not (isinstance(行们, list) and 行们 and all(isinstance(x, dict) for x in 行们)):
            continue
        列们 = list(dict.fromkeys(k for x in 行们 for k in x))
        引 = lambda x: '"' + str(x).replace('"', '""') + '"'
        conn.execute(f'CREATE TABLE "实体".{引(表)} ({", ".join(引(c) + " TEXT" for c in 列们)})')
        conn.executemany(
            f'INSERT INTO "实体".{引(表)} VALUES ({", ".join("?" * len(列们))})',
            [tuple(None if x.get(c) is None else str(x.get(c)) for c in 列们) for x in 行们])

#!/usr/bin/env python3
import json
import os
import sqlite3
import sys

from 工作视图 import 补视图表
from 运动提醒 import 补运动表
from 功能开关 import 补功能设置表

应用根 = os.path.dirname(os.path.abspath(__file__))
仓根 = os.path.dirname(应用根)
新库路径 = os.path.join(仓根, "数据", "待办.db")

def _读旧库():
    try:
        with open(os.path.join(应用根, "config.json"), encoding="utf-8") as f:
            return json.load(f).get("旧库") or {}
    except (OSError, ValueError):
        return {}


旧库 = _读旧库()

建表 = """
CREATE TABLE IF NOT EXISTS 待办(
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    来源         TEXT NOT NULL,
    父id         INTEGER,
    事项         TEXT NOT NULL,
    计划完成时间 TEXT,
    详情         TEXT,
    详情块       TEXT,
    速记原文     TEXT,
    状态         TEXT    NOT NULL DEFAULT '未开始'
                 CHECK(状态 IN ('未开始','进行中','已完成')),
    重要程度     INTEGER NOT NULL DEFAULT 1,
    目标数       INTEGER,
    归档         INTEGER NOT NULL DEFAULT 0,
    形态         TEXT    NOT NULL DEFAULT '待办'
                 CHECK(形态 IN ('待办','便笺')),
    钉住         INTEGER NOT NULL DEFAULT 0,
    创建时间     TEXT,
    最后修改时间 TEXT
);
CREATE INDEX IF NOT EXISTS idx_待办_父   ON 待办(父id);
CREATE INDEX IF NOT EXISTS idx_待办_来源 ON 待办(来源);
CREATE INDEX IF NOT EXISTS idx_待办_形态 ON 待办(来源,形态);

CREATE TABLE IF NOT EXISTS 待办评论(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    待办id   INTEGER NOT NULL,
    内容     TEXT,
    创建时间 TEXT,
    改过时间 TEXT
);
CREATE INDEX IF NOT EXISTS idx_待办评论_待办 ON 待办评论(待办id);

CREATE TABLE IF NOT EXISTS 待办附件(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    待办id   INTEGER NOT NULL,
    评论id   INTEGER,
    原名     TEXT,
    mime     TEXT,
    字节     INTEGER,
    数据     BLOB,
    创建时间 TEXT
);
CREATE INDEX IF NOT EXISTS idx_待办附件_待办 ON 待办附件(待办id);
CREATE INDEX IF NOT EXISTS idx_待办附件_评论 ON 待办附件(评论id);

CREATE TABLE IF NOT EXISTS 待办关联(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    待办id   INTEGER NOT NULL,
    关联类型 TEXT NOT NULL,
    关联键   TEXT NOT NULL,
    显示文本 TEXT,
    创建时间 TEXT,
    UNIQUE(待办id, 关联类型, 关联键)
);
CREATE INDEX IF NOT EXISTS idx_待办关联_待办 ON 待办关联(待办id);
CREATE INDEX IF NOT EXISTS idx_待办关联_对象 ON 待办关联(关联类型,关联键);

CREATE TABLE IF NOT EXISTS 待办历史(
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    待办id   INTEGER NOT NULL,
    来源     TEXT NOT NULL,
    时间     TEXT NOT NULL,
    快照     TEXT NOT NULL,
    摘要     TEXT
);
CREATE INDEX IF NOT EXISTS idx_待办历史_待办 ON 待办历史(待办id, 来源, 时间);
"""

触发器 = """
CREATE TRIGGER IF NOT EXISTS trg_待办_建时间 AFTER INSERT ON 待办
FOR EACH ROW WHEN NEW.最后修改时间 IS NULL
BEGIN
    UPDATE 待办 SET 最后修改时间=COALESCE(NEW.创建时间, datetime('now','localtime'))
    WHERE id=NEW.id;
END;
"""

不盖章列 = ("钉住", "deleted_at")


def 改时间触发器SQL(con):
    内容列 = [c for c in 列名(con, "待办") if c not in ("id", "最后修改时间") + 不盖章列]
    变了 = " OR ".join(f'NEW."{c}" IS NOT OLD."{c}"' for c in 内容列)
    return ("CREATE TRIGGER trg_待办_改时间 AFTER UPDATE ON 待办\n"
            f"FOR EACH ROW WHEN NEW.最后修改时间 IS OLD.最后修改时间 AND ({变了})\n"
            "BEGIN\n"
            "    UPDATE 待办 SET 最后修改时间=datetime('now','localtime') WHERE id=NEW.id;\n"
            "END")


def 补改时间触发器(con):
    要 = 改时间触发器SQL(con)
    有 = con.execute("SELECT sql FROM sqlite_master WHERE type='trigger' "
                     "AND name='trg_待办_改时间'").fetchone()
    if 有 and 有[0] == 要:
        return False
    con.execute("DROP TRIGGER IF EXISTS trg_待办_改时间")
    con.execute(要)
    return True

关联设置建表 = """
CREATE TABLE IF NOT EXISTS 关联显示设置(
    来源     TEXT NOT NULL,
    关联类型 TEXT NOT NULL,
    挑选列   TEXT NOT NULL DEFAULT '[]',
    格子列   TEXT NOT NULL DEFAULT '[]',
    更新时间 TEXT,
    PRIMARY KEY(来源, 关联类型)
);
"""


def 补关联设置表(con):
    已有 = bool(con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='关联显示设置'").fetchone())
    con.executescript(关联设置建表)
    return not 已有


四表 = ("待办", "待办评论", "待办附件", "待办关联", "待办历史")

回收站建表 = (
    "CREATE TABLE IF NOT EXISTS 回收站("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, 来源 TEXT NOT NULL, 名字 TEXT NOT NULL, "
    "删于 TEXT NOT NULL, 条们 TEXT NOT NULL DEFAULT '[]')",
    "CREATE INDEX IF NOT EXISTS idx_回收站_来源 ON 回收站(来源, 删于)",
)


def 补回收表(con):
    补了 = [] if 有表(con, "回收站") else ["回收站"]
    for s in 回收站建表:
        con.execute(s)
    for 表 in 四表:
        镜 = "回收_" + 表
        原列 = [(r[1], r[2]) for r in con.execute(f'PRAGMA table_info("{表}")')]
        if not 有表(con, 镜):
            列定义 = ", ".join(f'"{c}" {t}' for c, t in 原列)
            con.execute(f'CREATE TABLE IF NOT EXISTS "{镜}"(回收id INTEGER NOT NULL, {列定义})')
            con.execute(f'CREATE INDEX IF NOT EXISTS "idx_{镜}_回收" ON "{镜}"(回收id)')
            补了.append(镜)
            continue
        有 = set(列名(con, 镜))
        for c, t in 原列:
            if c not in 有:
                con.execute(f'ALTER TABLE "{镜}" ADD COLUMN "{c}" {t}')
                补了.append(f"{镜}.{c}")
    return 补了

外来建表 = (
    "CREATE TABLE IF NOT EXISTS 待办外来("
    "id INTEGER PRIMARY KEY AUTOINCREMENT, 来源 TEXT NOT NULL, 待办id INTEGER NOT NULL, "
    "外部 TEXT NOT NULL, 外部id TEXT NOT NULL, 外部改时间 INTEGER, 本地改时间 TEXT, "
    "原样 TEXT, 导入时间 TEXT, UNIQUE(来源, 外部, 外部id))",
)


def 补外来表(con):
    for s in 外来建表:
        con.execute(s)


后加列 = [
    ("待办", "钉住", "INTEGER NOT NULL DEFAULT 0"),
    ("待办", "速记原文", "TEXT"),
    ("待办评论", "改过时间", "TEXT"),
]


def 补列(con):
    补了 = []
    for 表, 列, 定义 in 后加列:
        if 列 in 列名(con, 表):
            continue
        con.execute(f'ALTER TABLE "{表}" ADD COLUMN "{列}" {定义}')
        补了.append(f"{表}.{列}")
    补了 += 补回收表(con)
    if 补改时间触发器(con):
        补了.append("触发器 trg_待办_改时间")
    if 补了:
        con.commit()
    return 补了


def 开新库(建=True, 路径=None):
    路径 = 路径 or 新库路径
    os.makedirs(os.path.dirname(路径), exist_ok=True)
    con = sqlite3.connect(路径, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    if 建:
        con.executescript(建表)
        con.executescript(触发器)
        补改时间触发器(con)
        补回收表(con)
        补视图表(con)
        补关联设置表(con)
        补运动表(con)
        con.commit()
    return con


def 备好库(路径):
    新建 = not os.path.exists(路径)
    con = 开新库(建=新建, 路径=路径)
    try:
        补了 = 补列(con)
        补视图表(con)
        补关联设置表(con)
        if 补运动表(con):
            补了.append("运动打卡 / 运动设置(表)")
        if 补功能设置表(con):
            补了.append("功能设置(表)")
        con.commit()
    finally:
        con.close()
    if 新建:
        return f"新建空库 {路径}"
    return f"{路径}" + (f"(补上了 {'、'.join(补了)})" if 补了 else "(结构都齐)")


def 开旧库(来源):
    p = 旧库[来源]
    if not os.path.exists(p):
        return None
    try:
        con = sqlite3.connect(f"file:{p}?mode=ro", uri=True, timeout=30)
    except sqlite3.Error:
        return None
    con.row_factory = sqlite3.Row
    return con


def 有表(con, 名):
    return bool(con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (名,)).fetchone())


def 列名(con, 表):
    return [r[1] for r in con.execute(f'PRAGMA table_info("{表}")')]


def 重写正文附件号(新con, 新待办ids, 附件映射):
    from 待办核心 import _块转镜像 as _镜像

    剔 = 0
    for 新id in list(新待办ids):
        行 = 新con.execute("SELECT 详情块 FROM 待办 WHERE id=?", (新id,)).fetchone()
        if not 行 or not 行[0]:
            continue
        try:
            块 = json.loads(行[0])
        except ValueError:
            continue
        if not isinstance(块, list):
            continue
        新块, 变了 = [], False
        for b in 块:
            if isinstance(b, dict) and b.get("type") in ("img", "file"):
                配 = 附件映射.get(b.get("附件id"))
                if 配 is None or 配[1] != 新id:
                    剔 += 1
                    变了 = True
                    continue
                if 配[0] != b.get("附件id"):
                    b = dict(b)
                    b["附件id"] = 配[0]
                    变了 = True
            新块.append(b)
        if 变了:
            新con.execute("UPDATE 待办 SET 详情块=?, 详情=? WHERE id=?",
                          (json.dumps(新块, ensure_ascii=False), _镜像(新块), 新id))
    return 剔


def 搬一家(新con, 来源):
    旧con = 开旧库(来源)
    数 = {t: 0 for t in 四表}
    if 旧con is None:
        return 数, f"库文件不在:{旧库[来源]}"
    try:
        if not 有表(旧con, "待办"):
            return 数, "旧库里没有 待办 表"
        旧列 = 列名(旧con, "待办")
        有形态 = "形态" in 旧列
        取 = ["id", "父id", "事项", "计划完成时间", "详情", "详情块",
              "状态", "重要程度", "目标数", "归档", "创建时间"]
        取 = [c for c in 取 if c in 旧列]
        if 有形态:
            取.append("形态")

        行们 = 旧con.execute(
            f'SELECT {",".join(chr(34)+c+chr(34) for c in 取)} FROM 待办 '
            "ORDER BY (父id IS NOT NULL), id").fetchall()
        id映射 = {}
        for r in 行们:
            d = dict(r)
            旧id = d.pop("id")
            父 = d.get("父id")
            d["父id"] = id映射.get(父) if 父 is not None else None
            d["来源"] = 来源
            d.setdefault("形态", "待办")
            if d.get("形态") not in ("待办", "便笺"):
                d["形态"] = "待办"
            列 = list(d.keys())
            cur = 新con.execute(
                f'INSERT INTO 待办({",".join(列)}) VALUES({",".join("?" * len(列))})',
                [d[c] for c in 列])
            id映射[旧id] = cur.lastrowid
            数["待办"] += 1

        评论映射 = {}
        if 有表(旧con, "待办评论"):
            for r in 旧con.execute("SELECT id,待办id,内容,创建时间 FROM 待办评论 ORDER BY id"):
                新待办id = id映射.get(r["待办id"])
                if 新待办id is None:
                    continue
                cur = 新con.execute(
                    "INSERT INTO 待办评论(待办id,内容,创建时间) VALUES(?,?,?)",
                    (新待办id, r["内容"], r["创建时间"]))
                评论映射[r["id"]] = cur.lastrowid
                数["待办评论"] += 1

        附件映射 = {}
        if 有表(旧con, "待办附件"):
            for r in 旧con.execute(
                    "SELECT id,待办id,评论id,原名,mime,字节,数据,创建时间 FROM 待办附件 ORDER BY id"):
                新待办id = id映射.get(r["待办id"])
                if 新待办id is None:
                    continue
                cur = 新con.execute(
                    "INSERT INTO 待办附件(待办id,评论id,原名,mime,字节,数据,创建时间) "
                    "VALUES(?,?,?,?,?,?,?)",
                    (新待办id, 评论映射.get(r["评论id"]) if r["评论id"] is not None else None,
                     r["原名"], r["mime"], r["字节"], r["数据"], r["创建时间"]))
                附件映射[r["id"]] = (cur.lastrowid, 新待办id)
                数["待办附件"] += 1

        警 = 重写正文附件号(新con, id映射.values(), 附件映射)
        if 警:
            数["坏引用剔除"] = 警

        if 有表(旧con, "待办关联"):
            for r in 旧con.execute(
                    "SELECT 待办id,关联类型,关联键,显示文本,创建时间 FROM 待办关联 ORDER BY id"):
                新待办id = id映射.get(r["待办id"])
                if 新待办id is None:
                    continue
                新con.execute(
                    "INSERT OR IGNORE INTO 待办关联(待办id,关联类型,关联键,显示文本,创建时间) "
                    "VALUES(?,?,?,?,?)",
                    (新待办id, r["关联类型"], r["关联键"], r["显示文本"], r["创建时间"]))
                数["待办关联"] += 1
        return 数, None
    finally:
        旧con.close()


def 对账():
    出 = []
    好 = True
    if not os.path.exists(新库路径):
        return [f"新库还不存在:{新库路径}"], False
    新con = 开新库(建=False)
    try:
        for 来源 in 旧库:
            旧con = 开旧库(来源)
            for t in 四表:
                新n = 新con.execute(
                    f'SELECT COUNT(*) FROM "{t}"' + (" WHERE 来源=?" if t == "待办" else
                                                     ' WHERE 待办id IN (SELECT id FROM 待办 WHERE 来源=?)'),
                    (来源,)).fetchone()[0]
                if 旧con is None or not 有表(旧con, t):
                    旧n = "(无表)"
                else:
                    旧n = 旧con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                同 = (旧n == 新n) if isinstance(旧n, int) else (新n == 0)
                好 = 好 and 同
                出.append(f"  {来源:5s} {t:6s} 旧={旧n!s:6s} 新={新n:<6d} {'✓' if 同 else '✗ 对不上'}")
            if 旧con:
                旧con.close()
    finally:
        新con.close()
    return 出, 好


def main():
    只对账 = "--只对账" in sys.argv
    重来 = "--重来" in sys.argv
    if "--建空库" in sys.argv:
        i = sys.argv.index("--建空库")
        if i + 1 >= len(sys.argv):
            print("用法:--建空库 <库文件路径>")
            return 1
        print(备好库(os.path.abspath(sys.argv[i + 1])))
        return 0
    if "--补列" in sys.argv:
        if not os.path.exists(新库路径):
            print(f"库还不存在,没得补:{新库路径}")
            return 1
        con = 开新库(建=False)
        try:
            补了 = 补列(con)
            新视图表 = 补视图表(con)
            新设置表 = 补关联设置表(con)
            新运动表 = 补运动表(con)
            新功能表 = 补功能设置表(con)
            con.commit()
            结构变化 = 补了 + (["待办视图(表)"] if 新视图表 else []) + (["关联显示设置(表)"] if 新设置表 else []) \
                + (["运动打卡 / 运动设置(表)"] if 新运动表 else []) + (["功能设置(表)"] if 新功能表 else [])
            print(("补上了:" + "、".join(结构变化)) if 结构变化 else "结构都齐,没动它")
            print("当前 待办 表的列:" + "、".join(列名(con, "待办")))
            print("保存视图表:" + ("已就绪" if 有表(con, "待办视图") else "缺失"))
            print("关联显示设置表:" + ("已就绪" if 有表(con, "关联显示设置") else "缺失"))
            print("运动提醒两张表:" + ("已就绪" if 有表(con, "运动打卡") and 有表(con, "运动设置") else "缺失"))
            print("功能设置表:" + ("已就绪" if 有表(con, "功能设置") else "缺失"))
        finally:
            con.close()
        return 0
    if 只对账:
        行, 好 = 对账()
        print("\n".join(行))
        print("对账结果:" + ("全对上" if 好 else "有对不上的"))
        return 0 if 好 else 1

    if os.path.exists(新库路径):
        if not 重来:
            print(f"新库已存在,不动它:{新库路径}")
            print("要重建(会删掉里面的数据)加 --重来;只想核数加 --只对账")
            return 1
        os.remove(新库路径)
        print(f"[--重来] 已删旧的新库:{新库路径}")

    新con = 开新库()
    补列(新con)
    汇总 = {}
    try:
        for 来源 in 旧库:
            数, note = 搬一家(新con, 来源)
            新con.commit()
            汇总[来源] = (数, note)
    finally:
        新con.close()

    print(f"新库:{新库路径}")
    for 来源, (数, note) in 汇总.items():
        print(f"  {来源:5s} " + "  ".join(f"{k}={v}" for k, v in 数.items())
              + (f"   ({note})" if note else ""))
    print()
    行, 好 = 对账()
    print("\n".join(行))
    print("对账结果:" + ("全对上" if 好 else "有对不上的"))
    print("\n★ 记得备份新库:拷走 待办.db 这一个文件就行。")
    return 0 if 好 else 1


if __name__ == "__main__":
    sys.exit(main())

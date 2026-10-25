import base64
import datetime as _dt
import ipaddress
import json
import re
import socket
import sqlite3
import urllib.parse
import urllib.request

import 公用
import 功能开关

_待办可改列 = {"事项", "计划完成时间", "详情", "状态", "重要程度", "目标数", "形态"}
_通用可改列 = _待办可改列 | {"钉住", "速记原文"}
_待办状态集 = {"未开始", "进行中", "已完成"}
_待办形态集 = {"便笺", "待办"}
_图mime扩 = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
             "image/gif": "gif", "image/webp": "webp"}


def _附件行(词con, 待办id=None, 评论id="__all__", 只图=False):
    sql = "SELECT id,原名,mime FROM 待办附件 WHERE 1=1"
    args = []
    if 待办id is not None:
        sql += " AND 待办id=?"; args.append(待办id)
    if 评论id != "__all__":
        if 评论id is None:
            sql += " AND 评论id IS NULL"
        else:
            sql += " AND 评论id=?"; args.append(评论id)
    if 只图:
        sql += " AND mime IN (%s)" % ",".join("?" * len(_图mime扩)); args += list(_图mime扩)
    sql += " ORDER BY id ASC"
    return [dict(r) for r in 词con.execute(sql, args)]


def _文件行(词con, 待办id, 评论id=None):
    ph = ",".join("?" * len(_图mime扩))
    cond = "评论id IS NULL" if 评论id is None else "评论id=?"
    args = [待办id] + ([] if 评论id is None else [评论id]) + list(_图mime扩)
    return [dict(r) for r in 词con.execute(
        f"SELECT id,原名,mime,字节,创建时间 FROM 待办附件 "
        f"WHERE 待办id=? AND {cond} AND mime NOT IN ({ph}) ORDER BY id ASC", args)]


def _列评论(词con, 待办id):
    评论 = [dict(r) for r in 词con.execute(
        "SELECT id,内容,创建时间,改过时间 FROM 待办评论 WHERE 待办id=? ORDER BY 创建时间 DESC, id DESC",
        (待办id,)).fetchall()]
    for c in 评论:
        c["图"] = _附件行(词con, 待办id, c["id"], 只图=True)
        c["文件"] = _文件行(词con, 待办id, c["id"])
    return 评论


class _来源错(ValueError):
    pass


_来源表 = {
    "本机": {"名": "独立待办", "类型集": set(), "实体表": {}, "计数类型": None, "深链": None},
}


def 待办来源集():
    try:
        配 = 公用.读配置().get("实体库") or {}
    except (OSError, ValueError):
        配 = {}
    return ["本机"] + [k for k in 配 if k in _来源表 and k != "本机"]


def 默认来源():
    return 待办来源集()[0]


def _取来源(d, 默认=None):
    s = (str(d.get("来源") or "") or 默认 or 默认来源()).strip()
    if s not in 待办来源集():
        raise _来源错(f"未知来源:{s}")
    return s


def _待办连库(来源):
    if 来源 not in (None, "") and 来源 not in _来源表:
        raise _来源错(f"未知来源:{来源}")
    try:
        return 公用.待办连库(来源 or 默认来源(), timeout=15)
    except sqlite3.Error as e:
        raise _来源错(f"待办库打不开:{e}") from e


def _认关联(来源, 类型):
    return 类型 in _来源表.get(来源, {}).get("类型集", ())


通用错话 = "这一步没成 —— 后台出了点问题,再试一次;还是不行请反馈这条报错"


def 记错(标签, e):
    此刻 = _dt.datetime.now()
    号 = "E" + 此刻.strftime("%H%M%S") + f"{此刻.microsecond // 10000:02d}"
    原文 = f"{type(e).__name__}: {e}"
    print(f"[{标签}] {号} {原文}", flush=True)
    return {"错误号": 号, "原文": f"[{标签}] {原文}"}


def _待办口(fn, d):
    try:
        return fn(d)
    except _来源错 as e:
        return {"ok": False, "error": 通用错话, **记错("待办口 来源错", e)}
    except sqlite3.Error as e:
        return {"ok": False, "error": 通用错话, **记错("待办口 库读写失败", e)}


def 待办详情(d):
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    词con = _待办连库(来源)
    try:
        行 = 词con.execute("SELECT * FROM 待办 WHERE id=? AND 来源=?", (rid, 来源)).fetchone()
        if not 行:
            return {"ok": False, "error": "待办不存在"}
        本体 = {k: 行[k] for k in 行.keys() if k != "详情块"}
        本体["来源"] = 来源
        return {"ok": True, "待办": 本体,
                "块": 读待办块(词con, 行),
                "详情图": _附件行(词con, rid, None, 只图=True),
                "文件": _文件行(词con, rid),
                "评论": _列评论(词con, rid)}
    finally:
        词con.close()


def 待办评论(d):
    op = (d.get("op") or "").strip()
    来源 = _取来源(d)
    词con = _待办连库(来源)
    try:
        if op == "add":
            try:
                待办id = int(d.get("待办id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 待办id"}
            内容 = (d.get("内容") or "").strip()
            if not 内容:
                return {"ok": False, "error": "评论不能为空"}
            if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (待办id, 来源)).fetchone():
                return {"ok": False, "error": "待办不存在"}
            cur = 词con.execute(
                "INSERT INTO 待办评论(待办id,内容,创建时间) VALUES(?,?,datetime('now','localtime'))",
                (待办id, 内容))
            词con.commit()
            return {"ok": True, "评论": _列评论(词con, 待办id), "新id": cur.lastrowid}
        if op == "edit":
            try:
                cid = int(d.get("id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 id"}
            内容 = (d.get("内容") or "").strip()
            if not 内容:
                return {"ok": False, "error": "评论不能为空"}
            行 = 词con.execute(
                "SELECT 待办id FROM 待办评论 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                (cid, 来源)).fetchone()
            if not 行:
                return {"ok": False, "error": "评论不存在"}
            词con.execute(
                "UPDATE 待办评论 SET 内容=?, 改过时间=datetime('now','localtime') WHERE id=?",
                (内容, cid))
            词con.commit()
            return {"ok": True, "评论": _列评论(词con, 行["待办id"])}
        if op == "del":
            try:
                cid = int(d.get("id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 id"}
            行 = 词con.execute(
                "SELECT 待办id FROM 待办评论 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                (cid, 来源)).fetchone()
            if not 行:
                return {"ok": False, "error": "评论不存在"}
            待办id = 行["待办id"]
            词con.execute("DELETE FROM 待办附件 WHERE 评论id=?", (cid,))
            词con.execute("DELETE FROM 待办评论 WHERE id=?", (cid,))
            词con.commit()
            return {"ok": True, "评论": _列评论(词con, 待办id)}
        return {"ok": False, "error": f"未知 op:{op}"}
    finally:
        词con.close()


_抓图上限 = 20 * 1024 * 1024
_抓图超时 = 12
_抓图UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def _嗅图mime(b):
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


def _外链取图(uri):
    uri = (uri or "").strip()
    try:
        u = urllib.parse.urlparse(uri)
    except ValueError as e:
        print(f"[外链取图] 网址不合法:{e}", flush=True)
        return None, None, "网址不合法"
    if u.scheme not in ("http", "https"):
        return None, None, f"只抓 http/https 的图,收到:{u.scheme or '空'}"
    host = (u.hostname or "").strip()
    if not host:
        return None, None, "网址里没有站点名"
    try:
        地址们 = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except OSError as e:
        print(f"[外链取图] 站点名解析不了:{e}", flush=True)
        return None, None, "这个站点名解析不了"
    for ip in 地址们:
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            return None, None, f"解出来的地址不认识:{ip}"
        if not addr.is_global:
            return None, None, f"只抓公网上的图,这个网址指向内网/本机({ip})"
    req = urllib.request.Request(uri, headers={
        "User-Agent": _抓图UA,
        "Referer": f"{u.scheme}://{host}/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    })
    try:
        with urllib.request.urlopen(req, timeout=_抓图超时) as resp:
            mime = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            数据 = resp.read(_抓图上限 + 1)
    except Exception as e:
        print(f"[外链取图] 拉不下来:{type(e).__name__} {e}", flush=True)
        return None, None, "拉不下来"
    if not 数据:
        return None, None, "拉下来是空的"
    if len(数据) > _抓图上限:
        return None, None, f"图太大(超过 {_抓图上限 // 1024 // 1024}MB)"
    if mime not in _图mime扩:
        嗅 = _嗅图mime(数据)
        if not 嗅:
            return None, None, f"这个网址给的不是图(Content-Type: {mime or '空'})"
        mime = 嗅
    return 数据, mime, None


def _存待办图(词con, 待办id, 评论id, 数据, mime, 原名):
    cur = 词con.execute(
        "INSERT INTO 待办附件(待办id,评论id,原名,mime,字节,创建时间,数据) "
        "VALUES(?,?,?,?,?,datetime('now','localtime'),?)",
        (待办id, 评论id, (原名 or "").strip()[:120], mime, len(数据), sqlite3.Binary(数据)))
    词con.commit()
    return cur.lastrowid


def _剔正文引用(词con, 待办id, 来源, 附件id):
    if 待办id is None:
        return 0
    行 = 词con.execute("SELECT 详情块 FROM 待办 WHERE id=? AND 来源=?", (待办id, 来源)).fetchone()
    if not 行 or not 行["详情块"]:
        return 0
    try:
        块 = json.loads(行["详情块"])
    except ValueError:
        return 0
    if not isinstance(块, list):
        return 0
    新块 = [b for b in 块
            if not (isinstance(b, dict) and b.get("type") in ("img", "file")
                    and b.get("附件id") == 附件id)]
    剔 = len(块) - len(新块)
    if 剔:
        词con.execute("UPDATE 待办 SET 详情块=?, 详情=? WHERE id=? AND 来源=?",
                      (json.dumps(新块, ensure_ascii=False), _块转镜像(新块), 待办id, 来源))
    return 剔


def 待办图片(d):
    op = (d.get("op") or "").strip()
    来源 = _取来源(d)
    词con = _待办连库(来源)
    try:
        if op == "add":
            try:
                待办id = int(d.get("待办id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 待办id"}
            评论id = d.get("评论id")
            评论id = int(评论id) if 评论id not in (None, "", 0, "0") else None
            mime = (d.get("mime") or "").strip().lower()
            if mime not in _图mime扩:
                return {"ok": False, "error": f"只收图片,收到:{mime or '空'}"}
            b64 = d.get("base64") or ""
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            try:
                数据 = base64.b64decode(b64)
            except Exception:
                return {"ok": False, "error": "图片解码失败"}
            if not 数据:
                return {"ok": False, "error": "空图片"}
            if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (待办id, 来源)).fetchone():
                return {"ok": False, "error": "待办不存在"}
            aid = _存待办图(词con, 待办id, 评论id, 数据, mime, d.get("原名"))
            return {"ok": True, "图": {"id": aid, "原名": (d.get("原名") or "").strip()[:120], "mime": mime}}
        if op == "fetch":
            try:
                待办id = int(d.get("待办id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 待办id"}
            评论id = d.get("评论id")
            评论id = int(评论id) if 评论id not in (None, "", 0, "0") else None
            if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (待办id, 来源)).fetchone():
                return {"ok": False, "error": "待办不存在"}
            数据, mime, 错 = _外链取图(d.get("url"))
            if 错:
                return {"ok": False, "error": 错}
            原名 = (d.get("原名") or urllib.parse.unquote(
                urllib.parse.urlparse((d.get("url") or "").strip()).path.rsplit("/", 1)[-1]) or "网页图")
            aid = _存待办图(词con, 待办id, 评论id, 数据, mime, 原名)
            return {"ok": True, "图": {"id": aid, "原名": 原名[:120], "mime": mime}}
        if op == "del":
            try:
                aid = int(d.get("id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 id"}
            if not 词con.execute(
                    "SELECT 1 FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                    (aid, 来源)).fetchone():
                return {"ok": False, "error": "图不存在"}
            属 = 词con.execute(
                "SELECT 待办id FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                (aid, 来源)).fetchone()
            词con.execute("DELETE FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                          (aid, 来源))
            剔 = _剔正文引用(词con, 属 and 属["待办id"], 来源, aid)
            词con.commit()
            return {"ok": True, "id": aid, "剔正文块": 剔}
        return {"ok": False, "error": f"未知 op:{op}"}
    finally:
        词con.close()


def 取待办图字节(aid, 来源=""):
    来源 = 来源 or 默认来源()
    try:
        aid = int(aid)
    except (TypeError, ValueError):
        return None
    try:
        词con = _待办连库(来源)
    except (_来源错, sqlite3.Error):
        return None
    try:
        行 = 词con.execute("SELECT 数据,mime FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                           (aid, 来源)).fetchone()
    finally:
        词con.close()
    if not 行 or 行["数据"] is None:
        return None
    return bytes(行["数据"]), (行["mime"] or "application/octet-stream")


_文件字节上限 = 20 * 1024 * 1024


def 待办文件(d):
    来源 = _取来源(d)
    op = (d.get("op") or "").strip()
    词con = _待办连库(来源)
    try:
        if op == "add":
            try:
                待办id = int(d.get("待办id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 待办id"}
            评论id = d.get("评论id")
            try:
                评论id = int(评论id) if 评论id not in (None, "", 0, "0") else None
            except (TypeError, ValueError):
                评论id = None
            mime = (d.get("mime") or "").strip().lower() or "application/octet-stream"
            if mime in _图mime扩:
                return {"ok": False, "error": "图片请走正文图片块(🖼/粘贴/拖入),附件区只收非图文件"}
            原名 = (d.get("原名") or "").strip()[:120]
            if not 原名:
                return {"ok": False, "error": "缺 原名(文件名)"}
            b64 = d.get("base64") or ""
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            try:
                数据 = base64.b64decode(b64)
            except Exception:
                return {"ok": False, "error": "文件解码失败"}
            if not 数据:
                return {"ok": False, "error": "空文件"}
            if len(数据) > _文件字节上限:
                return {"ok": False, "error": f"文件太大({len(数据)/1024/1024:.1f}MB),上限 {_文件字节上限//1024//1024}MB"}
            if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (待办id, 来源)).fetchone():
                return {"ok": False, "error": "待办不存在"}
            cur = 词con.execute(
                "INSERT INTO 待办附件(待办id,评论id,原名,mime,字节,创建时间,数据) "
                "VALUES(?,?,?,?,?,datetime('now','localtime'),?)",
                (待办id, 评论id, 原名, mime, len(数据), sqlite3.Binary(数据)))
            词con.commit()
            return {"ok": True, "文件": {"id": cur.lastrowid, "原名": 原名, "mime": mime, "字节": len(数据)}}
        if op == "del":
            try:
                aid = int(d.get("id"))
            except (TypeError, ValueError):
                return {"ok": False, "error": "缺 id"}
            行 = 词con.execute("SELECT mime,待办id FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                               (aid, 来源)).fetchone()
            if not 行:
                return {"ok": False, "error": "文件不存在"}
            if (行["mime"] or "") in _图mime扩:
                return {"ok": False, "error": "这是图,不归附件区删(图片块/评论里的 ✕)"}
            词con.execute("DELETE FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)", (aid, 来源))
            剔 = _剔正文引用(词con, 行["待办id"], 来源, aid)
            词con.commit()
            return {"ok": True, "id": aid, "剔正文块": 剔}
        return {"ok": False, "error": f"未知 op:{op}"}
    finally:
        词con.close()


def 取待办文件字节(aid, 来源=""):
    来源 = 来源 or 默认来源()
    try:
        aid = int(aid)
    except (TypeError, ValueError):
        return None
    try:
        词con = _待办连库(来源)
    except (_来源错, sqlite3.Error):
        return None
    try:
        行 = 词con.execute("SELECT 数据,mime,原名 FROM 待办附件 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                           (aid, 来源)).fetchone()
    finally:
        词con.close()
    if not 行 or 行["数据"] is None:
        return None
    return bytes(行["数据"]), (行["mime"] or "application/octet-stream"), (行["原名"] or "附件")


def 建待办(d):
    来源 = _取来源(d)
    事项 = (d.get("事项") or "").strip()
    形态 = (str(d.get("形态") or "待办")).strip()
    if 形态 not in _待办形态集:
        形态 = "待办"
    if not 事项 and 形态 == "便笺":
        for 行 in (d.get("详情") or "").splitlines():
            if 行.strip():
                事项 = 行.strip()[:200]
                break
    if not 事项:
        return {"ok": False, "error": "便笺正文不能全空" if 形态 == "便笺" else "事项不能为空"}
    状态 = (d.get("状态") or "未开始").strip()
    if 状态 not in _待办状态集:
        状态 = "未开始"
    try:
        重要程度 = min(3, max(1, int(d.get("重要程度") or 1)))
    except (TypeError, ValueError):
        重要程度 = 1
    父id = d.get("父id")
    词con = _待办连库(来源)
    try:
        if 父id not in (None, "", 0):
            try:
                父id = int(父id)
            except (TypeError, ValueError):
                return {"ok": False, "error": "父id 非法"}
            父 = 词con.execute("SELECT 父id FROM 待办 WHERE id=? AND 来源=?", (父id, 来源)).fetchone()
            if not 父:
                return {"ok": False, "error": "父待办不存在"}
            if 父["父id"] is not None:
                return {"ok": False, "error": "父待办已是子待办,不能再挂子(限一层)"}
        else:
            父id = None
        目标数 = d.get("目标数")
        try:
            目标数 = max(1, int(目标数)) if 目标数 not in (None, "", 0, "0") else None
        except (TypeError, ValueError):
            目标数 = None
        cur = 词con.execute(
            "INSERT INTO 待办(来源,父id,事项,计划完成时间,详情,状态,重要程度,目标数,形态,创建时间) "
            "VALUES(?,?,?,?,?,?,?,?,?,datetime('now','localtime'))",
            (来源, 父id, 事项, (d.get("计划完成时间") or "").strip(),
             (d.get("详情") or "").strip(), 状态, 重要程度, 目标数, 形态))
        词con.commit()
        return {"ok": True, "id": cur.lastrowid, "父id": 父id, "来源": 来源, "形态": 形态}
    finally:
        词con.close()


def 删待办(d):
    if d.get("ids") is not None:
        分组 = _分组ids(d)
        if 分组 is None:
            return {"ok": False, "error": "缺 ids(数字数组,或 [{来源,id}])"}
        删数 = 子数 = 0
        回收ids = []
        for src, ids in 分组.items():
            词con = _待办连库(src)
            try:
                r = _搬进回收站(词con, src, ids)
                词con.commit()
            finally:
                词con.close()
            if r:
                删数 += r["删数"]
                子数 += r["删子数"]
                回收ids.append({"来源": src, "回收id": r["回收id"]})
        if not 删数:
            return {"ok": False, "error": "待办不存在"}
        return {"ok": True, "删数": 删数, "删子数": 子数, "回收ids": 回收ids}
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    词con = _待办连库(来源)
    try:
        r = _搬进回收站(词con, 来源, [rid])
        if not r:
            return {"ok": False, "error": "待办不存在"}
        词con.commit()
        return {"ok": True, "id": rid, "删子数": r["删子数"], "回收id": r["回收id"]}
    finally:
        词con.close()


回收站留天数 = 10
回收站上限 = 100
_回收子表 = ("待办评论", "待办附件", "待办关联")


def _回收说():
    return f"留 {回收站留天数} 天 · 最多 {回收站上限} 条"


def _列串(con, 表):
    from 建库与迁移 import 列名
    return ",".join(f'"{c}"' for c in 列名(con, 表))


def _占(n):
    return ",".join("?" * n)


def _搬进回收站(con, 来源, ids):
    from 建库与迁移 import 补回收表
    补回收表(con)
    ids = list(dict.fromkeys(int(x) for x in ids))
    行们 = {r["id"]: r for r in con.execute(
        f"SELECT id,父id,事项,形态 FROM 待办 WHERE 来源=? AND id IN ({_占(len(ids))})", (来源, *ids))}
    顶 = [i for i in ids if i in 行们 and 行们[i]["父id"] not in 行们]
    if not 顶:
        return None
    子 = [r[0] for r in con.execute(
        f"SELECT id FROM 待办 WHERE 来源=? AND 父id IN ({_占(len(顶))})", (来源, *顶))]
    全 = list(dict.fromkeys(顶 + 子))
    软件 = _来源表.get(来源, {}).get("名", 来源)
    父名 = {r["id"]: r["事项"] for r in con.execute(
        f"SELECT id,事项 FROM 待办 WHERE 来源=? AND id IN "
        f"(SELECT 父id FROM 待办 WHERE 来源=? AND id IN ({_占(len(顶))}))", (来源, 来源, *顶))}
    条们 = []
    for i in 顶:
        r = 行们[i]
        if r["父id"] is not None:
            类型, 处 = "子待办", f"「{(父名.get(r['父id']) or '')[:20]}」底下"
        else:
            类型 = "便笺" if r["形态"] == "便笺" else "待办"
            处 = f"{软件} · {'便笺' if 类型 == '便笺' else '待办列表'}"
        条们.append({"id": i, "名字": r["事项"], "类型": 类型, "原来在": 处})
    名字 = 条们[0]["名字"] if len(条们) == 1 else f"一次删的 {len(条们)} 条"
    回收id = con.execute(
        "INSERT INTO 回收站(来源,名字,删于,条们) VALUES(?,?,datetime('now','localtime'),?)",
        (来源, 名字, json.dumps(条们, ensure_ascii=False))).lastrowid
    占 = _占(len(全))
    for 表 in _回收子表:
        列 = _列串(con, 表)
        con.execute(f"INSERT INTO 回收_{表}(回收id,{列}) SELECT ?,{列} FROM {表} "
                    f"WHERE 待办id IN (SELECT id FROM 待办 WHERE 来源=? AND id IN ({占}))", (回收id, 来源, *全))
        con.execute(f"DELETE FROM {表} WHERE 待办id IN (SELECT id FROM 待办 WHERE 来源=? AND id IN ({占}))",
                    (来源, *全))
    列 = _列串(con, "待办历史")
    con.execute(f"INSERT INTO 回收_待办历史(回收id,{列}) SELECT ?,{列} FROM 待办历史 "
                f"WHERE 来源=? AND 待办id IN ({占})", (回收id, 来源, *全))
    con.execute(f"DELETE FROM 待办历史 WHERE 来源=? AND 待办id IN ({占})", (来源, *全))
    列 = _列串(con, "待办")
    con.execute(f"INSERT INTO 回收_待办(回收id,{列}) SELECT ?,{列} FROM 待办 WHERE 来源=? AND id IN ({占})",
                (回收id, 来源, *全))
    con.execute(f"DELETE FROM 待办 WHERE 来源=? AND id IN ({占})", (来源, *全))
    _清回收站(con, 来源)
    return {"回收id": 回收id, "删数": len(顶), "删子数": len(全) - len(顶)}


def _删回收行(con, 来源, 回收ids):
    占 = _占(len(回收ids))
    for 表 in ("待办评论", "待办附件", "待办关联", "待办历史", "待办"):
        con.execute(f"DELETE FROM 回收_{表} WHERE 回收id IN "
                    f"(SELECT id FROM 回收站 WHERE 来源=? AND id IN ({占}))", (来源, *回收ids))
    con.execute(f"DELETE FROM 回收站 WHERE 来源=? AND id IN ({占})", (来源, *回收ids))


def _清回收站(con, 来源):
    清 = [r[0] for r in con.execute(
        "SELECT id FROM 回收站 WHERE 来源=? AND (删于 < datetime('now','localtime',?) "
        "OR id NOT IN (SELECT id FROM 回收站 WHERE 来源=? ORDER BY id DESC LIMIT ?))",
        (来源, f"-{回收站留天数} days", 来源, 回收站上限))]
    if 清:
        _删回收行(con, 来源, 清)
    return len(清)


def _回收条们(con, 来源, 回收id):
    r = con.execute("SELECT 条们 FROM 回收站 WHERE id=? AND 来源=?", (回收id, 来源)).fetchone()
    return None if r is None else json.loads(r["条们"] or "[]")


def _改回收条们(con, 来源, 回收id, 条们):
    if 条们:
        名字 = 条们[0]["名字"] if len(条们) == 1 else f"一次删的 {len(条们)} 条"
        con.execute("UPDATE 回收站 SET 条们=?, 名字=? WHERE id=? AND 来源=?",
                    (json.dumps(条们, ensure_ascii=False), 名字, 回收id, 来源))
    else:
        _删回收行(con, 来源, [回收id])


def _搬回一条(con, 来源, 回收id, tid, 带回):
    行 = con.execute("SELECT 父id FROM 回收_待办 WHERE 回收id=? AND 来源=? AND id=?",
                     (回收id, 来源, tid)).fetchone()
    if 行 is None:
        return False
    父id, 放顶层 = 行["父id"], False
    if 父id is not None:
        父 = con.execute("SELECT 父id FROM 待办 WHERE id=? AND 来源=?", (父id, 来源)).fetchone()
        if 父 is None:
            在 = con.execute("SELECT 回收id,事项 FROM 回收_待办 WHERE 来源=? AND id=?", (来源, 父id)).fetchone()
            if 在 is not None:
                _搬回一条(con, 来源, 在["回收id"], 父id, [])
                剩 = [x for x in (_回收条们(con, 来源, 在["回收id"]) or []) if x["id"] != 父id]
                _改回收条们(con, 来源, 在["回收id"], 剩)
                带回.append(在["事项"])
            else:
                放顶层 = True
        elif 父["父id"] is not None:
            放顶层 = True
    全 = [r[0] for r in con.execute(
        "SELECT id FROM 回收_待办 WHERE 回收id=? AND 来源=? AND (id=? OR 父id=?)", (回收id, 来源, tid, tid))]
    占 = _占(len(全))
    列 = _列串(con, "待办")
    con.execute(f"INSERT INTO 待办({列}) SELECT {列} FROM 回收_待办 WHERE 回收id=? AND 来源=? AND id IN ({占})",
                (回收id, 来源, *全))
    if 放顶层:
        con.execute("UPDATE 待办 SET 父id=NULL WHERE id=? AND 来源=?", (tid, 来源))
    for 表 in _回收子表:
        列 = _列串(con, 表)
        con.execute(f"INSERT INTO {表}({列}) SELECT {列} FROM 回收_{表} WHERE 回收id=? "
                    f"AND 待办id IN (SELECT id FROM 待办 WHERE 来源=? AND id IN ({占}))", (回收id, 来源, *全))
        con.execute(f"DELETE FROM 回收_{表} WHERE 回收id=? "
                    f"AND 待办id IN (SELECT id FROM 待办 WHERE 来源=? AND id IN ({占}))", (回收id, 来源, *全))
    列 = _列串(con, "待办历史")
    con.execute(f"INSERT INTO 待办历史({列}) SELECT {列} FROM 回收_待办历史 "
                f"WHERE 回收id=? AND 来源=? AND 待办id IN ({占})", (回收id, 来源, *全))
    con.execute(f"DELETE FROM 回收_待办历史 WHERE 回收id=? AND 来源=? AND 待办id IN ({占})", (回收id, 来源, *全))
    con.execute(f"DELETE FROM 回收_待办 WHERE 回收id=? AND 来源=? AND id IN ({占})", (回收id, 来源, *全))
    if 放顶层:
        带回.append(None)
    return True


def 回收站(d):
    from 建库与迁移 import 补回收表
    op = (d.get("op") or "list").strip()
    if op == "list":
        来源们 = [_取来源(d)] if d.get("来源") else 待办来源集()
        出 = []
        for src in 来源们:
            con = _待办连库(src)
            try:
                补回收表(con)
                _清回收站(con, src)
                con.commit()
                for r in con.execute("SELECT id,名字,删于,条们 FROM 回收站 WHERE 来源=? ORDER BY id DESC", (src,)):
                    条们 = json.loads(r["条们"] or "[]")
                    时 = (r["删于"] or "")[5:16]
                    子们 = [{**x, "回收id": r["id"], "来源": src, "删于": 时} for x in 条们]
                    条 = {"回收id": r["id"], "来源": src, "名字": r["名字"], "删于": 时, "_序": r["删于"]}
                    if len(子们) == 1:
                        条.update({k: 子们[0][k] for k in ("id", "类型", "原来在")})
                    else:
                        处们 = {x["原来在"] for x in 条们}
                        条.update({"类型": "一批", "原来在": 处们.pop() if len(处们) == 1 else "好几处", "子们": 子们})
                    出.append(条)
            finally:
                con.close()
        出.sort(key=lambda x: x.pop("_序"), reverse=True)
        return {"ok": True, "说": _回收说(), "条们": 出}
    if op != "restore":
        return {"ok": False, "error": f"不认识的 op:{op}"}
    来源 = _取来源(d)
    try:
        回收id = int(d.get("回收id"))
        tid = None if d.get("id") in (None, "") else int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 回收id"}
    con = _待办连库(来源)
    try:
        补回收表(con)
        条们 = _回收条们(con, 来源, 回收id)
        if 条们 is None:
            return {"ok": False, "error": f"回收站里没这一条了(超过 {回收站留天数} 天或满 {回收站上限} 条会被清掉)"}
        要 = [x["id"] for x in 条们] if tid is None else [tid]
        if tid is not None and tid not in {x["id"] for x in 条们}:
            return {"ok": False, "error": "这一条已经不在回收站这一行里了"}
        带回 = []
        还原数 = sum(1 for i in 要 if _搬回一条(con, 来源, 回收id, i, 带回))
        _改回收条们(con, 来源, 回收id, [x for x in 条们 if x["id"] not in 要])
        con.commit()
        return {"ok": True, "还原数": 还原数, "连主待办": [x for x in 带回 if x],
                "回顶层": sum(1 for x in 带回 if x is None)}
    finally:
        con.close()


def 建待办关联(d):
    来源 = _取来源(d)
    try:
        待办id = int(d.get("待办id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 待办id"}
    关联类型 = (d.get("关联类型") or "").strip()
    if not _认关联(来源, 关联类型):
        return {"ok": False, "error": f"关联类型非法:{关联类型}"}
    关联键 = (str(d.get("关联键") or "")).strip()
    if not 关联键:
        return {"ok": False, "error": "关联键不能为空"}
    显示文本 = (str(d.get("显示文本") or "")).strip() or 关联键
    词con = _待办连库(来源)
    try:
        if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (待办id, 来源)).fetchone():
            return {"ok": False, "error": "待办不存在"}
        已有 = 词con.execute(
            "SELECT id FROM 待办关联 WHERE 待办id=? AND 关联类型=? AND 关联键=?",
            (待办id, 关联类型, 关联键)).fetchone()
        if 已有:
            return {"ok": True, "id": 已有["id"], "已存在": True}
        try:
            cur = 词con.execute(
                "INSERT INTO 待办关联(待办id,关联类型,关联键,显示文本,创建时间) "
                "VALUES(?,?,?,?,datetime('now','localtime'))",
                (待办id, 关联类型, 关联键, 显示文本))
        except sqlite3.IntegrityError:
            词con.rollback()
            r = 词con.execute(
                "SELECT id FROM 待办关联 WHERE 待办id=? AND 关联类型=? AND 关联键=?",
                (待办id, 关联类型, 关联键)).fetchone()
            return {"ok": True, "id": r["id"], "已存在": True} if r else \
                   {"ok": False, "error": "挂关联失败(唯一约束)"}
        词con.commit()
        return {"ok": True, "id": cur.lastrowid}
    finally:
        词con.close()


def 删待办关联(d):
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    词con = _待办连库(来源)
    try:
        cur = 词con.execute("DELETE FROM 待办关联 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)", (rid, 来源))
        词con.commit()
        return {"ok": True, "id": rid, "删除": cur.rowcount}
    finally:
        词con.close()


def 改挂关联(d):
    来源 = _取来源(d)
    类型 = (d.get("类型") or "").strip()
    if not _认关联(来源, 类型):
        return {"ok": False, "error": f"关联类型非法:{类型}"}
    旧, 新 = (str(d.get("旧") or "")).strip(), (str(d.get("新") or "")).strip()
    if not 旧 or not 新:
        return {"ok": False, "error": "旧、新 都不能为空"}
    if 旧 == 新:
        return {"ok": False, "error": "旧和新是同一个,不用改挂"}
    显示文本 = (str(d.get("显示文本") or "")).strip() or None
    词con = _待办连库(来源)
    try:
        行们 = 词con.execute(
            "SELECT l.id, l.待办id FROM 待办关联 l JOIN 待办 t ON t.id=l.待办id "
            "WHERE t.来源=? AND l.关联类型=? AND l.关联键=?", (来源, 类型, 旧)).fetchall()
        去重 = 0
        for r in 行们:
            if 词con.execute("SELECT 1 FROM 待办关联 WHERE 待办id=? AND 关联类型=? AND 关联键=? "
                            "AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                            (r["待办id"], 类型, 新, 来源)).fetchone():
                词con.execute("DELETE FROM 待办关联 WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                             (r["id"], 来源))
                去重 += 1
            else:
                词con.execute("UPDATE 待办关联 SET 关联键=?, 显示文本=COALESCE(?, 显示文本) "
                             "WHERE id=? AND 待办id IN (SELECT id FROM 待办 WHERE 来源=?)",
                             (新, 显示文本, r["id"], 来源))
        词con.commit()
        return {"ok": True, "moved": len(行们), "去重": 去重}
    finally:
        词con.close()


def 反查待办(d):
    来源 = _取来源(d)
    关联类型 = (d.get("关联类型") or "").strip()
    关联键 = (str(d.get("关联键") or "")).strip()
    if not _认关联(来源, 关联类型):
        return {"ok": False, "error": f"关联类型非法:{关联类型}"}
    if not 关联键:
        return {"ok": False, "error": "关联键不能为空"}
    词con = _待办连库(来源)
    try:
        rows = 词con.execute(
            "SELECT t.id,t.父id,t.事项,t.状态,t.重要程度,t.计划完成时间,t.创建时间, "
            "       l.id AS 关联id,l.显示文本 "
            "FROM 待办关联 l JOIN 待办 t ON t.id=l.待办id "
            "WHERE t.来源=? AND l.关联类型=? AND l.关联键 IN (?,?) AND t.归档=0 "
            "ORDER BY (l.关联键<>?), (t.状态='已完成'), t.创建时间 DESC, t.id DESC",
            (来源, 关联类型, 关联键, _老键(来源, 关联类型, 关联键) or 关联键, 关联键)).fetchall()
        见, 待办 = set(), []
        for r in rows:
            if r["id"] not in 见:
                见.add(r["id"])
                待办.append(dict(r))
        待办.sort(key=lambda t: (t["创建时间"] or "", t["id"]), reverse=True)
        待办.sort(key=lambda t: t["状态"] == "已完成")
        return {"ok": True, "关联类型": 关联类型, "关联键": 关联键, "待办": 待办}
    finally:
        词con.close()


def 建待办带关联(d):
    来源 = _取来源(d)
    事项 = (d.get("事项") or "").strip()
    if not 事项:
        return {"ok": False, "error": "事项不能为空"}
    关联 = d.get("关联")
    if not isinstance(关联, list) or not 关联:
        return {"ok": False, "error": "关联不能为空(就地建待办必带选中行)"}
    if len(关联) > 500:
        return {"ok": False, "error": f"一次最多挂 500 条关联(现 {len(关联)} 条,分批建)"}
    净, 见 = [], set()
    for x in 关联:
        if not isinstance(x, dict):
            return {"ok": False, "error": "关联项必须是对象"}
        类型 = (x.get("关联类型") or "").strip()
        键 = (str(x.get("关联键") or "")).strip()
        if not _认关联(来源, 类型):
            return {"ok": False, "error": f"关联类型非法:{类型}"}
        if not 键:
            return {"ok": False, "error": "关联键不能为空"}
        if (类型, 键) in 见:
            continue
        见.add((类型, 键))
        净.append((类型, 键, (str(x.get("显示文本") or "")).strip() or 键))
    词con = _待办连库(来源)
    try:
        cur = 词con.execute(
            "INSERT INTO 待办(来源,父id,事项,计划完成时间,详情,状态,重要程度,创建时间) "
            "VALUES(?,NULL,?,?,'','未开始',1,datetime('now','localtime'))",
            (来源, 事项, (d.get("计划完成时间") or "").strip()))
        rid = cur.lastrowid
        词con.executemany(
            "INSERT INTO 待办关联(待办id,关联类型,关联键,显示文本,创建时间) "
            "VALUES(?,?,?,?,datetime('now','localtime'))",
            [(rid, t, k, s) for t, k, s in 净])
        词con.commit()
        return {"ok": True, "id": rid, "关联数": len(净)}
    finally:
        词con.close()


def 待办角标(d):
    来源 = _取来源(d)
    关联类型 = (d.get("关联类型") or "").strip()
    if not _认关联(来源, 关联类型):
        return {"ok": False, "error": f"关联类型非法:{关联类型}"}
    词con = _待办连库(来源)
    try:
        rows = 词con.execute(
            "SELECT l.关联键, COUNT(DISTINCT l.待办id) AS n FROM 待办关联 l "
            "JOIN 待办 t ON t.id=l.待办id WHERE t.来源=? AND l.关联类型=? AND t.归档=0 "
            "GROUP BY l.关联键", (来源, 关联类型)).fetchall()
        return {"ok": True, "关联类型": 关联类型, "计数": {r["关联键"]: r["n"] for r in rows}}
    finally:
        词con.close()


def _关联悬空(经con, 词con, 关联类型, 关联键, 来源="本机"):
    if 来源 in _来源表:
        表 = _来源表.get(来源, {}).get("实体表", {}).get(关联类型)
        if not 表:
            return False
        try:
            键 = int(关联键)
        except (TypeError, ValueError):
            键 = 关联键
        try:
            return not 词con.execute(f'SELECT 1 FROM "实体".{表[0]} WHERE {表[1]}=? LIMIT 1', (键,)).fetchone()
        except sqlite3.Error:
            return False
    return False


_关联前缀 = {
}
_键即号 = set()

_号表 = {
}

_老键形状 = {
}


def _列元组(键列):
    return (键列,) if isinstance(键列, str) else tuple(键列)


def _键定位(来源, 关联类型, 键, 列们):
    键 = str(键 or "")
    列们 = _列元组(列们)
    if not 键 or not 列们:
        return None
    if len(列们) == 1:
        return 列们, (键,)
    段 = 键.split("|", len(列们) - 1)
    if len(段) == len(列们) and all(段):
        return 列们, tuple(段)
    老 = _老键形状.get((来源, 关联类型))
    return ((老,), (键,)) if 老 else None


def _老键(来源, 关联类型, 键):
    老 = _老键形状.get((来源, 关联类型))
    表 = _关联字段表.get((来源, 关联类型))
    if not 老 or not 表:
        return None
    定位 = _键定位(来源, 关联类型, 键, 表["键列"])
    if not 定位 or len(定位[0]) < 2 or 老 not in 定位[0]:
        return None
    return 定位[1][定位[0].index(老)]


def _号表查(词con, 来源, 关联类型, 键):
    项 = _号表.get((来源, 关联类型))
    if not 项 or 词con is None:
        return None
    定位 = _键定位(来源, 关联类型, 键, 项[1])
    if 定位 is None:
        return None
    列们, 值们 = 定位
    条件 = " AND ".join(f"{c}=?" for c in 列们)
    try:
        rows = 词con.execute(
            f'SELECT 序号 FROM "实体".{项[0]} WHERE {条件} LIMIT 2', 值们).fetchall()
    except sqlite3.Error:
        return None
    return rows[0][0] if len(rows) == 1 else None


def _号表批(词con, 来源, 关联类型, 键们):
    项 = _号表.get((来源, 关联类型))
    键们 = [k for k in dict.fromkeys(str(k) for k in 键们) if k]
    if not 项 or 词con is None or not 键们:
        return {}
    组 = {}
    for k in 键们:
        定位 = _键定位(来源, 关联类型, k, 项[1])
        if 定位 is not None:
            组.setdefault(定位[0], {}).setdefault(定位[1], k)
    out = {}
    for 列们, 值表 in 组.items():
        列串 = ",".join(列们)
        一行 = "(" + ",".join("?" * len(列们)) + ")"
        值单 = list(值表)
        for i in range(0, len(值单), 200):
            片 = 值单[i:i + 200]
            参数 = [v for 值们 in 片 for v in 值们]
            条件 = (f"{列串} IN ({','.join('?' * len(片))})" if len(列们) == 1
                    else f"({列串}) IN (VALUES {','.join([一行] * len(片))})")
            try:
                rows = 词con.execute(
                    f'SELECT {列串}, MIN(序号) FROM "实体".{项[0]} WHERE {条件} '
                    f'GROUP BY {列串} HAVING COUNT(*) = 1', 参数).fetchall()
            except sqlite3.Error:
                return {}
            for r in rows:
                原 = 值表.get(tuple(str(x) for x in r[:len(列们)]))
                if 原 is not None:
                    out[原] = r[-1]
    return out


def _关联号(经con, 来源, 关联类型, 关联键, 词con=None, 号缓存=None):
    键 = str(关联键 or "").strip()
    前 = _关联前缀.get((来源, 关联类型))
    if not 前:
        return ""
    if (来源, 关联类型) in _号表:
        序 = 号缓存.get(键) if 号缓存 is not None else _号表查(词con, 来源, 关联类型, 键)
        return "%s%04d" % (前, int(序)) if 序 else ""
    if (来源, 关联类型) in _键即号:
        键 = 键.upper()
        return 键 if 键.startswith(前) and 键[len(前):].isdigit() else ""
    if 键.isdigit():
        return "%s%04d" % (前, int(键))
    return ""


def _待办关联标签(词con, 经con, 待办id, 来源="本机"):
    rows = 词con.execute(
        "SELECT id AS 关联id,关联类型,关联键,显示文本 FROM 待办关联 WHERE 待办id=? ORDER BY id",
        (待办id,)).fetchall()
    out = []
    for r in rows:
        c = dict(r)
        c["悬空"] = _关联悬空(经con, 词con, c["关联类型"], c["关联键"], 来源)
        c["号"] = _关联号(经con, 来源, c["关联类型"], c["关联键"], 词con)
        out.append(c)
    return out


_关联字段表 = {
}


def _字段下发(来源):
    out = {}
    for 类型 in sorted(_来源表.get(来源, {}).get("类型集", ())):
        表 = _关联字段表.get((来源, 类型))
        if 表:
            out[类型] = {"字段": [{"键": f[0], "名": f[1]} for f in 表["字段"]],
                        "挑": list(表["挑"]), "格": list(表["格"])}
    return out


def 来源集清单():
    return [{"key": k, "名": _来源表[k]["名"],
             "类型": sorted(_来源表[k]["类型集"]),
             "量化": bool(_来源表[k]["计数类型"]),
             "计数类型": _来源表[k]["计数类型"],
             "深链": _来源表[k].get("深链"),
             "关联字段": _字段下发(k)} for k in 待办来源集()]


def _转值(f, v):
    if len(f) > 3 and f[3] and v is not None:
        v = f[3](v)
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return v


def _键参(表, 键):
    if 表["键型"] == "数":
        try:
            return int(键)
        except (TypeError, ValueError):
            return None
    return str(键)


def _表名(表):
    return ('"实体".' if 表["库"] == "实体" else "") + 表["表"]


def _键选句(表):
    列们 = _列元组(表["键列"])
    return 列们[0] if len(列们) == 1 else " || '|' || ".join(列们)


def _字段选句(表):
    return ", ".join(f'{f[2]} AS "f{i}"' for i, f in enumerate(表["字段"]))


def _行转f(表, r):
    return {f[0]: _转值(f, r[f"f{i}"]) for i, f in enumerate(表["字段"])}


def _取字段值(词con, 经con, 来源, 类型, 键们):
    表 = _关联字段表.get((来源, 类型))
    键们 = [str(k) for k in 键们 if k is not None]
    if not 表 or not 键们:
        return {}
    con = 词con
    if con is None:
        return {}
    列们 = _列元组(表["键列"])
    组 = {}
    for k in dict.fromkeys(键们):
        if len(列们) == 1:
            v = _键参(表, k)
            定位 = (列们, (v,)) if v is not None else None
        else:
            定位 = _键定位(来源, 类型, k, 列们)
        if 定位 is None:
            continue
        格 = 组.setdefault(定位[0], {}).setdefault(
            tuple(str(x) for x in 定位[1]), (定位[1], []))
        格[1].append(k)
    限 = f"({表['限']}) AND " if 表.get("限") else ""
    out = {}
    try:
        for 列组, 值表 in 组.items():
            列串 = ",".join(列组)
            选k = ", ".join(f'{c} AS "_k{i}"' for i, c in enumerate(列组))
            一行 = "(" + ",".join("?" * len(列组)) + ")"
            值单 = list(值表.values())
            for i in range(0, len(值单), 500):
                批 = 值单[i:i + 500]
                参数 = [v for 值们, _ in 批 for v in 值们]
                条件 = (f"{列串} IN ({','.join('?' * len(批))})" if len(列组) == 1
                        else f"({列串}) IN (VALUES {','.join([一行] * len(批))})")
                for r in con.execute(
                        f"SELECT {选k}, {_字段选句(表)} FROM {_表名(表)} "
                        f"WHERE {限}{条件}", 参数):
                    命中 = 值表.get(tuple(str(r[f"_k{j}"]) for j in range(len(列组))))
                    if 命中:
                        f = _行转f(表, r)
                        for 原 in 命中[1]:
                            out[原] = f
    except sqlite3.Error:
        return {}
    return out


def _清列(表, 列, 段名="挑选时显示"):
    if not isinstance(列, list):
        raise ValueError("列名单格式不对")
    合法 = {f[0] for f in 表["字段"]}
    out = []
    for k in 列:
        k = str(k or "")
        if k not in 合法:
            raise ValueError(f"没有「{k}」这一列")
        if k not in out:
            out.append(k)
    if not out:
        raise ValueError(f"{段名}至少留一列")
    return out


def _关联设置(con, 来源):
    存 = {}
    try:
        for r in con.execute("SELECT 关联类型,挑选列,格子列 FROM 关联显示设置 WHERE 来源=?", (来源,)):
            存[r["关联类型"]] = r
    except sqlite3.Error:
        pass
    out = {}
    for 类型 in _来源表.get(来源, {}).get("类型集", ()):
        表 = _关联字段表.get((来源, 类型))
        if not 表:
            continue
        挑, 格, 存过 = list(表["挑"]), list(表["格"]), False
        r = 存.get(类型)
        if r:
            try:
                挑 = _清列(表, json.loads(r["挑选列"] or "[]"))
                格 = _清列(表, json.loads(r["格子列"] or "[]"), "格子里显示")
                存过 = True
            except (ValueError, TypeError):
                挑, 格 = list(表["挑"]), list(表["格"])
        out[类型] = {"挑": 挑, "格": 格, "存过": 存过}
    return out


def 关联显示设置接口(d):
    来源 = _取来源(d)
    op = str(d.get("op") or "get")
    con = _待办连库(来源)
    try:
        if op == "get":
            return {"ok": True, "来源": 来源, "设置": _关联设置(con, 来源)}
        类型 = str(d.get("类型") or "").strip()
        表 = _关联字段表.get((来源, 类型))
        if not _认关联(来源, 类型) or not 表:
            return {"ok": False, "error": f"「{类型}」没有可设置的列"}
        from 建库与迁移 import 补关联设置表
        补关联设置表(con)
        if op == "reset":
            con.execute("DELETE FROM 关联显示设置 WHERE 来源=? AND 关联类型=?", (来源, 类型))
        elif op == "set":
            try:
                挑 = _清列(表, d.get("挑"))
                格 = _清列(表, d.get("格"), "格子里显示")
            except ValueError as e:
                return {"ok": False, "error": str(e)}
            con.execute(
                "INSERT INTO 关联显示设置(来源,关联类型,挑选列,格子列,更新时间) "
                "VALUES(?,?,?,?,datetime('now','localtime')) "
                "ON CONFLICT(来源,关联类型) DO UPDATE SET 挑选列=excluded.挑选列,"
                "格子列=excluded.格子列,更新时间=excluded.更新时间",
                (来源, 类型, json.dumps(挑, ensure_ascii=False), json.dumps(格, ensure_ascii=False)))
        else:
            return {"ok": False, "error": f"不认识的操作:{op}"}
        con.commit()
        return {"ok": True, "来源": 来源, "设置": _关联设置(con, 来源)}
    finally:
        con.close()


def _补格子(词con, 经con, 来源, 节点们):
    设置 = _关联设置(词con, 来源)
    按类 = {}
    for n in 节点们:
        for l in n["关联"]:
            if l["关联类型"] in 设置:
                按类.setdefault(l["关联类型"], []).append(l)
    for 类型, 标们 in 按类.items():
        表 = _关联字段表[(来源, 类型)]
        名 = {f[0]: f[1] for f in 表["字段"]}
        格 = 设置[类型]["格"]
        值 = _取字段值(词con, 经con, 来源, 类型, [l["关联键"] for l in 标们]) if 格 else {}
        for l in 标们:
            f = 值.get(str(l["关联键"]), {})
            l["格"] = [{"键": k, "名": 名[k],
                       "值": (f.get(k) if f.get(k) not in (None, "") else
                             ((l["显示文本"] or l["关联键"]) if k == "名称" else None))}
                      for k in 格]


_图mime串 = ",".join("'%s'" % m for m in _图mime扩)


def _待办节点列(来源):
    计 = _来源表.get(来源, {}).get("计数类型")
    进度 = (f"(SELECT COUNT(*) FROM 待办关联 l WHERE l.待办id=t.id AND l.关联类型='{计}') AS 进度,"
          if 计 else "0 AS 进度,")
    return ("SELECT t.id,t.父id,t.事项,t.详情,t.状态,t.重要程度,t.计划完成时间,t.创建时间,"
            "t.最后修改时间,t.归档,t.目标数,t.形态,t.钉住,"
            + 进度 +
            "(SELECT COUNT(*) FROM 待办评论 c WHERE c.待办id=t.id) AS 评论数,"
            f"(SELECT COUNT(*) FROM 待办附件 a WHERE a.待办id=t.id AND a.评论id IS NULL AND a.mime IN ({_图mime串})) AS 图数,"
            f"(SELECT COUNT(*) FROM 待办附件 a WHERE a.待办id=t.id AND a.评论id IS NULL AND a.mime NOT IN ({_图mime串})) AS 文件数 "
            "FROM 待办 t ")


_待办排序 = " ORDER BY (t.状态='已完成'),(t.计划完成时间 IS NULL OR t.计划完成时间=''),t.计划完成时间 ASC,t.创建时间 DESC,t.id DESC"


def _合并排序(顶层):
    顶层.sort(key=lambda n: ((n["创建时间"] or ""), n["id"]), reverse=True)
    顶层.sort(key=lambda n: (1 if n["状态"] == "已完成" else 0,
                            0 if (n["计划完成时间"] or "") else 1,
                            n["计划完成时间"] or ""))
    return 顶层


def 列待办树(d):
    关联类型 = (d.get("关联类型") or "").strip()
    状态 = (d.get("状态") or "").strip()
    q = (str(d.get("q") or "")).strip()
    归档视图 = str(d.get("归档") or "") in ("1", "true", "True")
    来源们 = [默认来源()]
    请求来源 = (str(d.get("来源") or "")).strip()
    if 请求来源 == "*":
        来源们 = 待办来源集()
        请求来源 = ""
    elif 请求来源:
        if 请求来源 not in 待办来源集():
            raise _来源错(f"未知来源:{请求来源}")
        来源们 = [请求来源]
    顶层, 来源状态 = [], {}
    经con = None
    try:
        for src in 来源们:
            where = ["t.来源=?", "t.父id IS NULL"]
            args = [src]
            if 归档视图:
                where.append("(t.归档=1 OR EXISTS(SELECT 1 FROM 待办 c "
                             "WHERE c.父id=t.id AND c.来源=t.来源 AND c.归档=1))")
            else:
                where.append("t.归档=0")
            if 状态 in _待办状态集:
                where.append("t.状态=?"); args.append(状态)
            if q:
                像 = "%" + q + "%"
                where.append("(t.事项 LIKE ? OR t.详情 LIKE ? OR '#'||t.id LIKE ? OR "
                             "EXISTS(SELECT 1 FROM 待办关联 l WHERE l.待办id=t.id AND l.显示文本 LIKE ?) OR "
                             "EXISTS(SELECT 1 FROM 待办 c WHERE c.父id=t.id AND c.来源=t.来源 "
                             "AND (c.事项 LIKE ? OR c.详情 LIKE ? OR '#'||c.id LIKE ?)))")
                args += [像] * 7
            if 关联类型:
                if not _认关联(src, 关联类型):
                    continue
                where.append("EXISTS(SELECT 1 FROM 待办关联 l WHERE l.待办id=t.id AND l.关联类型=?)")
                args.append(关联类型)
            try:
                词con = _待办连库(src)
            except (_来源错, sqlite3.Error) as e:
                print(f"[列待办] {src} 连库失败:{e}", flush=True)
                来源状态[src] = 通用错话
                continue
            try:
                节点 = _待办节点列(src)
                本家 = []
                for r in 词con.execute(节点 + "WHERE " + " AND ".join(where) + _待办排序, args).fetchall():
                    n = dict(r)
                    n["来源"] = src
                    n["关联"] = _待办关联标签(词con, 经con, n["id"], src)
                    n["子"] = []
                    子归档过滤 = "" if (归档视图 and n["归档"]) else " AND t.归档=?"
                    子参数 = (src, n["id"]) if 子归档过滤 == "" else (src, n["id"], 1 if 归档视图 else 0)
                    for c in 词con.execute(
                            节点 + "WHERE t.来源=? AND t.父id=?" + 子归档过滤 +
                            " ORDER BY (t.状态='已完成'),t.创建时间 ASC,t.id ASC", 子参数).fetchall():
                        sn = dict(c)
                        sn["来源"] = src
                        sn["关联"] = _待办关联标签(词con, 经con, sn["id"], src)
                        n["子"].append(sn)
                        本家.append(sn)
                    本家.append(n)
                    顶层.append(n)
                _补格子(词con, 经con, src, 本家)
            except sqlite3.Error as e:
                print(f"[列待办] {src} 待办读不出来:{e}", flush=True)
                来源状态[src] = f"{_来源表[src]['名']}的待办读不出来"
            finally:
                词con.close()
        return {"ok": True, "待办": _合并排序(顶层),
                "来源集": 来源集清单(),
                "功能": 功能开关.读(),
                "来源状态": 来源状态,
                "筛": {"关联类型": 关联类型 or None, "状态": 状态 or None, "q": q or None,
                      "归档": 归档视图, "来源": 请求来源 or None}}
    finally:
        if 经con is not None:
            经con.close()


def 改待办(d):
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    列 = (d.get("列") or "").strip()
    if 列 not in _通用可改列:
        return {"ok": False, "error": f"不可改列:{列}"}
    值 = d.get("值")
    if 列 == "详情":
        文 = (str(值) if 值 is not None else "").strip()
        r = 存待办块({"来源": 来源, "id": d.get("id"),
                     "块": [{"type": "text", "text": 文}] if 文 else []})
        if not r.get("ok"):
            return r
        return {"ok": True, "id": r["id"], "列": "详情", "值": 文}
    if 列 == "状态":
        值 = (str(值 or "")).strip()
        if 值 not in _待办状态集:
            return {"ok": False, "error": f"状态非法:{值}"}
    elif 列 == "钉住":
        值 = 1 if str(值) in ("1", "true", "True") else 0
    elif 列 == "形态":
        值 = (str(值 or "")).strip()
        if 值 not in _待办形态集:
            return {"ok": False, "error": f"形态非法:{值}(只收 便笺 / 待办)"}
    elif 列 == "重要程度":
        try:
            值 = min(3, max(1, int(值)))
        except (TypeError, ValueError):
            return {"ok": False, "error": "重要程度须 1~3"}
    elif 列 == "目标数":
        if 值 in (None, "", 0, "0"):
            值 = None
        else:
            try:
                值 = max(1, int(值))
            except (TypeError, ValueError):
                return {"ok": False, "error": "目标数须是不小于 1 的整数(清空=撤掉量化)"}
    else:
        值 = (str(值) if 值 is not None else "").strip()
    词con = _待办连库(来源)
    try:
        行 = 词con.execute(
            "SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (rid, 来源)).fetchone()
        if not 行:
            return {"ok": False, "error": "待办不存在"}
        词con.execute(f"UPDATE 待办 SET {列}=? WHERE id=? AND 来源=?", (值, rid, 来源))
        词con.commit()
        return {"ok": True, "id": rid, "列": 列, "值": 值}
    finally:
        词con.close()


def _分组ids(d):
    ids = d.get("ids")
    if not isinstance(ids, list) or not ids:
        return None
    外层来源 = str(d.get("来源") or "").strip()
    出 = {}
    for x in ids:
        try:
            if isinstance(x, dict):
                src = (str(x.get("来源") or "") or 默认来源()).strip()
                if src not in 待办来源集():
                    return None
                rid = int(x.get("id"))
            else:
                src = 外层来源 or 默认来源()
                if src not in 待办来源集():
                    return None
                rid = int(x)
        except (TypeError, ValueError):
            return None
        出.setdefault(src, []).append(rid)
    return 出


def 归档待办(d):
    分组 = _分组ids(d)
    if 分组 is None:
        return {"ok": False, "error": "缺 ids(数字数组,或 [{来源,id}])"}
    目标 = 1 if str(d.get("归档")) in ("1", "true", "True") else 0
    按来源, 总改 = {}, 0
    for src, ids in 分组.items():
        词con = _待办连库(src)
        try:
            改 = set()
            for rid in ids:
                if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?",
                                    (rid, src)).fetchone():
                    continue
                改.add(rid)
                for r in 词con.execute("SELECT id FROM 待办 WHERE 父id=? AND 来源=?",
                                      (rid, src)).fetchall():
                    改.add(r[0])
            for rid in 改:
                词con.execute("UPDATE 待办 SET 归档=? WHERE id=? AND 来源=?", (目标, rid, src))
            词con.commit()
            按来源[src] = {"改数": len(改)}
            总改 += len(改)
        except sqlite3.Error as e:
            词con.rollback()
            按来源[src] = {"改数": 0, "错误": 通用错话, **记错(f"归档待办 {src}", e)}
        finally:
            词con.close()
    return {"ok": True, "归档": 目标, "改数": 总改, "按来源": 按来源}


_批量可改列 = {"状态", "重要程度", "计划完成时间"}


def 批量改待办(d):
    分组 = _分组ids(d)
    if 分组 is None:
        return {"ok": False, "error": "缺 ids(数字数组,或 [{来源,id}])"}
    列 = (d.get("列") or "").strip()
    if 列 not in _批量可改列:
        return {"ok": False, "error": f"不可批量改列:{列}"}
    值 = d.get("值")
    if 列 == "状态":
        值 = (str(值 or "")).strip()
        if 值 not in _待办状态集:
            return {"ok": False, "error": f"状态非法:{值}"}
    elif 列 == "重要程度":
        try:
            值 = min(3, max(1, int(值)))
        except (TypeError, ValueError):
            return {"ok": False, "error": "重要程度须 1~3"}
    else:
        值 = (str(值) if 值 is not None else "").strip()
    按来源, 总改, 总数 = {}, 0, sum(len(v) for v in 分组.values())
    for src, ids in 分组.items():
        词con = _待办连库(src)
        try:
            改数 = 0
            for rid in ids:
                cur = 词con.execute(f"UPDATE 待办 SET {列}=? WHERE id=? AND 来源=?", (值, rid, src))
                改数 += cur.rowcount
            词con.commit()
            按来源[src] = {"改数": 改数}
            总改 += 改数
        except sqlite3.Error as e:
            词con.rollback()
            按来源[src] = {"改数": 0, "错误": 通用错话, **记错(f"批量改待办 {src}", e)}
        finally:
            词con.close()
    return {"ok": True, "列": 列, "值": 值, "改数": 总改, "跳过": 总数 - 总改, "按来源": 按来源}


def 转待办层级(d):
    分组 = _分组ids(d)
    if 分组 is None:
        return {"ok": False, "error": "缺 ids(数字数组,或 [{来源,id}])"}
    if len(分组) > 1:
        名 = "、".join(_来源表[k]["名"] for k in 分组)
        return {"ok": False, "error": f"转层级只能在同一个软件里做:你勾的行里有{名}的。"}
    src = next(iter(分组))
    ids = 分组[src]
    父id = d.get("父id")
    词con = _待办连库(src)
    try:
        if 父id in (None, "", 0):
            父id = None
        else:
            try:
                父id = int(父id)
            except (TypeError, ValueError):
                return {"ok": False, "error": "父id 非法"}
            if 父id in ids:
                return {"ok": False, "error": "目标父待办不能同时在被转列表里"}
            父 = 词con.execute("SELECT 父id FROM 待办 WHERE id=? AND 来源=?", (父id, src)).fetchone()
            if not 父:
                return {"ok": False, "error": "父待办不存在"}
            if 父["父id"] is not None:
                return {"ok": False, "error": "目标已是子待办,不能再往下挂(限一层)"}
        改数, 跳过 = 0, []
        for rid in ids:
            行 = 词con.execute("SELECT 父id FROM 待办 WHERE id=? AND 来源=?", (rid, src)).fetchone()
            if not 行:
                跳过.append({"id": rid, "因": "不存在"}); continue
            if 父id is not None and 词con.execute(
                    "SELECT 1 FROM 待办 WHERE 父id=? AND 来源=? LIMIT 1", (rid, src)).fetchone():
                跳过.append({"id": rid, "因": "自己带着子待办(限一层)"}); continue
            if 行["父id"] == 父id:
                跳过.append({"id": rid, "因": "已在目标层"}); continue
            词con.execute("UPDATE 待办 SET 父id=? WHERE id=? AND 来源=?", (父id, rid, src))
            改数 += 1
        词con.commit()
        return {"ok": True, "父id": 父id, "来源": src, "改数": 改数, "跳过": 跳过}
    finally:
        词con.close()


def _json数组串(s):
    try:
        v = json.loads(s or "[]")
        return "、".join(str(x) for x in v) if isinstance(v, list) else str(s)
    except (ValueError, TypeError):
        return str(s or "")


def _挑sub(表, f, 挑):
    名 = {x[0]: x[1] for x in 表["字段"]}
    return [f"{名[k]} {f[k]}" for k in 挑 if k != "名称" and f.get(k) not in (None, "")]


def 搜关联(d):
    来源 = _取来源(d)
    类型 = (d.get("类型") or "").strip()
    if not _认关联(来源, 类型):
        return {"ok": False, "error": f"类型非法:{类型}"}
    表 = _关联字段表.get((来源, 类型))
    if not 表:
        return {"ok": False, "error": f"「{类型}」这一版还没有可搜的下拉"}
    设置 = {}
    q = (str(d.get("q") or "")).strip().lower()
    像 = f"%{q}%"
    items = []
    经con = 词con = None
    try:
        词con = _待办连库(来源)
        设置 = _关联设置(词con, 来源).get(类型, {})
        if 表["库"] != "实体":
            return {"ok": False, "error": f"「{类型}」这一版还没有可搜的下拉"}
        else:
            con = 词con
            if 表["库"] == "实体" and not con.execute(
                    "SELECT 1 FROM pragma_database_list WHERE name='实体'").fetchone():
                return {"ok": False, "error": f"{_来源表[来源]['名']}的库这次没挂上,搜不了;稍后再试"}
            限 = f"({表['限']}) AND " if 表.get("限") else ""
            选k = _键选句(表)
            搜 = " OR ".join([f"CAST({选k} AS TEXT) LIKE ?"] + [f"{x} LIKE ?" for x in 表["搜"]])
            rows = con.execute(
                f"SELECT {选k} AS _k, {_字段选句(表)} FROM {_表名(表)} "
                f"WHERE {限}(? = '' OR {搜}) ORDER BY {表['排序']} LIMIT 50",
                [q] + [像] * (1 + len(表["搜"]))).fetchall()
            挑 = 设置.get("挑") or 表["挑"]
            for r in rows:
                f = _行转f(表, r)
                k = str(r["_k"])
                items.append({"k": k, "t": str(f.get("名称") or k), "sub": _挑sub(表, f, 挑), "f": f})
        号缓存 = _号表批(词con, 来源, 类型, [x["k"] for x in items])
        for x in items:
            x["号"] = _关联号(经con, 来源, 类型, x["k"], 词con, 号缓存)
    except sqlite3.Error as e:
        print(f"[搜关联] {来源}/{类型} 查询失败:{e}", flush=True)
        return {"ok": False, "error": "这一步没成 —— 那个软件的库读不出来,稍后再试"}
    finally:
        for c in (经con, 词con):
            if c is not None:
                c.close()
    return {"ok": True, "来源": 来源, "类型": 类型, "items": items, "设置": 设置}


_块对齐集 = {"left", "center", "right"}
_组名上限 = 32


def _合法日期(v):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v or ""):
        return False
    try:
        _dt.datetime.strptime(v, "%Y-%m-%d")
        return True
    except (ValueError, TypeError):
        return False


def _合法时间(v):
    if not re.fullmatch(r"\d{2}:\d{2}", v or ""):
        return False
    try:
        _dt.datetime.strptime(v, "%H:%M")
        return True
    except (ValueError, TypeError):
        return False

_缩进上限 = 6


def _块通用(nb, b):
    g = str(b.get("组") or "").strip()[:_组名上限]
    if g:
        nb["组"] = g
        if b.get("组收起"):
            nb["组收起"] = True
    try:
        lv = int(b.get("层") or 0)
    except (TypeError, ValueError):
        lv = 0
    if lv > 0:
        nb["层"] = min(lv, _缩进上限)
    return nb


def _块转镜像(块列表):
    段 = []
    序 = 0
    for b in 块列表:
        t = b.get("type")
        文 = (b.get("text") or "").strip()
        if t == "text" and 文:
            段.append(文)
        elif t == "img":
            段.append("[图]")
        elif t == "quote" and 文:
            段.append(文)
        elif t == "file":
            段.append("[文件]")
        elif t == "table":
            表 = [" | ".join(str(格) for 格 in (行 or []))
                  for 行 in (b.get("行") or []) if any(str(格).strip() for 格 in (行 or []))]
            if 表:
                段.append("\n".join(表))
        elif t == "date":
            日期 = b.get("日期") or ""
            时间 = b.get("时间") or ""
            if 日期:
                段.append(日期 + ((" " + 时间) if 时间 else ""))
        elif t == "code" and 文:
            段.append(文)
        elif t == "hr":
            段.append("———")
        elif t == "fold":
            标 = (b.get("标题") or "").strip()
            段.append("\n".join(x for x in (标, 文) if x) or "")
        elif t == "todo":
            段.append(("[x] " if b.get("勾") else "[ ] ") + 文)
        elif t == "ul" and 文:
            段.append("· " + 文)
        elif t == "ol":
            序 += 1
            段.append(f"{序}. {文}")
        elif t == "h" and 文:
            段.append(文)
        if t != "ol":
            序 = 0
    return "\n".join(x for x in 段 if x)


def 读待办块(词con, 行):
    raw = 行["详情块"] if "详情块" in 行.keys() else None
    if raw:
        try:
            v = json.loads(raw)
            if isinstance(v, list):
                return v
        except ValueError:
            pass
    老 = (行["详情"] or "").strip()
    return [{"type": "text", "text": 老}] if 老 else []


def 存待办块(d):
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    块入 = d.get("块")
    if not isinstance(块入, list):
        return {"ok": False, "error": "块 须是数组"}
    词con = _待办连库(来源)
    try:
        if not 词con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (rid, 来源)).fetchone():
            return {"ok": False, "error": "待办不存在"}
        ph = ",".join("?" * len(_图mime扩))
        本待办图 = {r["id"] for r in 词con.execute(
            f"SELECT id FROM 待办附件 WHERE 待办id=? AND 评论id IS NULL AND mime IN ({ph})",
            [rid, *_图mime扩])}
        块 = []
        用到图 = set()
        for i, b in enumerate(块入):
            if not isinstance(b, dict):
                return {"ok": False, "error": f"第{i+1}块不是对象"}
            t = b.get("type")
            if t == "text":
                块.append({"type": "text", "text": str(b.get("text") or "")})
            elif t == "img":
                try:
                    aid = int(b.get("附件id"))
                except (TypeError, ValueError):
                    return {"ok": False, "error": f"第{i+1}块(图)缺 附件id"}
                if aid not in 本待办图:
                    return {"ok": False, "error": f"第{i+1}块引的图 {aid} 不是本待办的详情图"}
                用到图.add(aid)
                nb = {"type": "img", "附件id": aid}
                if b.get("w"):
                    try:
                        nb["w"] = max(40, min(4000, int(b["w"])))
                    except (TypeError, ValueError):
                        pass
                if b.get("al") in _块对齐集:
                    nb["al"] = b["al"]
                块.append(nb)
            elif t == "code":
                nb = {"type": "code", "text": str(b.get("text") or "")}
                lang = str(b.get("lang") or "").strip()[:20]
                if lang:
                    nb["lang"] = lang
                块.append(nb)
            elif t == "hr":
                块.append({"type": "hr"})
            elif t == "fold":
                块.append({"type": "fold",
                           "标题": str(b.get("标题") or ""),
                           "text": str(b.get("text") or ""),
                           "展开": bool(b.get("展开"))})
            elif t == "todo":
                块.append({"type": "todo", "text": str(b.get("text") or ""), "勾": bool(b.get("勾"))})
            elif t in ("ol", "ul"):
                块.append({"type": t, "text": str(b.get("text") or "")})
            elif t == "h":
                try:
                    级 = int(b.get("级") or 2)
                except (TypeError, ValueError):
                    级 = 2
                块.append({"type": "h", "text": str(b.get("text") or ""), "级": 级 if 级 in (1, 2, 3) else 2})
            elif t == "quote":
                块.append({"type": "quote", "text": str(b.get("text") or "")})
            elif t == "file":
                try:
                    aid = int(b.get("附件id"))
                except (TypeError, ValueError):
                    return {"ok": False, "error": f"第{i+1}块(文件)缺 附件id"}
                文件行 = 词con.execute(
                    f"SELECT 1 FROM 待办附件 WHERE id=? "
                    f"AND 待办id IN (SELECT id FROM 待办 WHERE id=? AND 来源=?) AND 评论id IS NULL "
                    f"AND mime NOT IN ({ph})", (aid, rid, 来源, *_图mime扩)).fetchone()
                if not 文件行:
                    return {"ok": False, "error": f"第{i+1}块引的文件 {aid} 不是本待办的附件"}
                块.append({"type": "file", "附件id": aid})
            elif t == "table":
                行入 = b.get("行")
                if not isinstance(行入, list):
                    return {"ok": False, "error": f"第{i+1}块(表格)缺 行"}
                行入 = 行入[:50]
                列数 = max(1, min(10, len(行入[0]) if 行入 and isinstance(行入[0], list) else 0))
                表行 = []
                for 原行 in 行入:
                    原行 = 原行 if isinstance(原行, list) else []
                    一行 = [str(格)[:500] for 格 in 原行[:列数]]
                    一行.extend([""] * (列数 - len(一行)))
                    表行.append(一行)
                if not 表行:
                    表行 = [[""]]
                块.append({"type": "table", "表头": bool(b.get("表头")), "行": 表行})
            elif t == "date":
                日期 = str(b.get("日期") or "")
                nb = {"type": "date", "日期": 日期 if _合法日期(日期) else ""}
                时间 = str(b.get("时间") or "")
                if _合法时间(时间):
                    nb["时间"] = 时间
                块.append(nb)
            else:
                return {"ok": False, "error": f"第{i+1}块类型非法:{t}"}
            _块通用(块[-1], b)
        孤儿 = 本待办图 - 用到图
        for aid in 孤儿:
            词con.execute("DELETE FROM 待办附件 WHERE id=?", (aid,))
        词con.execute("UPDATE 待办 SET 详情块=?, 详情=? WHERE id=? AND 来源=?",
                      (json.dumps(块, ensure_ascii=False), _块转镜像(块), rid, 来源))
        词con.commit()
        return {"ok": True, "id": rid, "块数": len(块), "清理图数": len(孤儿)}
    finally:
        词con.close()


def _历史快照文本(v):
    if isinstance(v, str):
        v = json.loads(v)
    if not isinstance(v, dict):
        raise ValueError("快照须是对象")
    return json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _当前历史快照(con, rid, 来源):
    行 = con.execute(
        "SELECT 事项,详情块 FROM 待办 WHERE id=? AND 来源=?", (rid, 来源)).fetchone()
    if not 行:
        return None
    关联 = [dict(x) for x in con.execute(
        "SELECT id,关联类型,关联键,显示文本 FROM 待办关联 WHERE 待办id=? "
        "AND 待办id IN (SELECT id FROM 待办 WHERE id=? AND 来源=?) ORDER BY id",
        (rid, rid, 来源))]
    附件 = [dict(x) for x in con.execute(
        "SELECT id,评论id,原名,mime,字节 FROM 待办附件 WHERE 待办id=? "
        "AND 待办id IN (SELECT id FROM 待办 WHERE id=? AND 来源=?) ORDER BY id",
        (rid, rid, 来源))]
    try:
        块 = json.loads(行["详情块"] or "[]")
    except ValueError:
        块 = []
    return {"标题": 行["事项"] or "", "块": 块, "关联": 关联, "附件清单": 附件}


def _写历史(con, rid, 来源, 快照, 摘要=""):
    文 = _历史快照文本(快照)
    上 = con.execute(
        "SELECT 快照 FROM 待办历史 WHERE 待办id=? AND 来源=? ORDER BY id DESC LIMIT 1",
        (rid, 来源)).fetchone()
    if 上 and 上["快照"] == 文:
        return False
    con.execute(
        "INSERT INTO 待办历史(待办id,来源,时间,快照,摘要) "
        "VALUES(?,?,datetime('now','localtime'),?,?)", (rid, 来源, 文, str(摘要 or "")[:120]))
    con.execute(
        "DELETE FROM 待办历史 WHERE 待办id=? AND 来源=? AND 时间 < datetime('now','-1 month','localtime')",
        (rid, 来源))
    con.execute(
        "DELETE FROM 待办历史 WHERE 待办id=? AND 来源=? AND id NOT IN "
        "(SELECT id FROM 待办历史 WHERE 待办id=? AND 来源=? ORDER BY id DESC LIMIT 100)",
        (rid, 来源, rid, 来源))
    return True


def 存待办历史(d):
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
        文 = _历史快照文本(d.get("快照"))
    except (TypeError, ValueError, json.JSONDecodeError) as e:
        return {"ok": False, "error": 通用错话, **记错("存待办历史 参数不对", e)}
    con = _待办连库(来源)
    try:
        if not con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (rid, 来源)).fetchone():
            return {"ok": False, "error": "待办不存在"}
        新 = _写历史(con, rid, 来源, 文, d.get("摘要"))
        con.commit()
        return {"ok": True, "新增": bool(新)}
    finally:
        con.close()


def 列待办历史(d):
    来源 = _取来源(d)
    try:
        rid = int(d.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    con = _待办连库(来源)
    try:
        if not con.execute("SELECT 1 FROM 待办 WHERE id=? AND 来源=?", (rid, 来源)).fetchone():
            return {"ok": False, "版本": []}
        版 = [dict(x) for x in con.execute(
            "SELECT id,时间,摘要 FROM 待办历史 WHERE 待办id=? AND 来源=? ORDER BY id DESC LIMIT 100",
            (rid, 来源))]
        return {"ok": True, "版本": 版}
    finally:
        con.close()


def 取待办历史(d):
    来源 = _取来源(d)
    try:
        rid, hid = int(d.get("id")), int(d.get("历史id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    con = _待办连库(来源)
    try:
        行 = con.execute(
            "SELECT 快照 FROM 待办历史 WHERE id=? AND 待办id=? AND 来源=?", (hid, rid, 来源)).fetchone()
        return {"ok": bool(行), "快照": 行["快照"] if 行 else None}
    finally:
        con.close()


def 恢复待办历史(d):
    来源 = _取来源(d)
    try:
        rid, hid = int(d.get("id")), int(d.get("历史id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "缺 id"}
    con = _待办连库(来源)
    try:
        行 = con.execute(
            "SELECT 快照 FROM 待办历史 WHERE id=? AND 待办id=? AND 来源=?", (hid, rid, 来源)).fetchone()
        当前 = _当前历史快照(con, rid, 来源)
        if not 行 or 当前 is None:
            return {"ok": False, "error": "历史版本不存在"}
        _写历史(con, rid, 来源, 当前, "恢复前自动保存")
        目标 = json.loads(行["快照"])
        原块 = 目标.get("块") if isinstance(目标.get("块"), list) else []
        有效附件 = {int(x["id"]) for x in con.execute(
            "SELECT id FROM 待办附件 WHERE 待办id=? "
            "AND 待办id IN (SELECT id FROM 待办 WHERE id=? AND 来源=?)",
            (rid, rid, 来源))}
        块, 缺附件数 = [], 0
        for b in 原块:
            if isinstance(b, dict) and b.get("type") in ("img", "file"):
                try:
                    aid = int(b.get("附件id"))
                except (TypeError, ValueError):
                    aid = 0
                if not aid or aid not in 有效附件:
                    缺附件数 += 1
                    continue
            块.append(b)
        标题 = str(目标.get("标题") or "未命名待办")[:200]
        con.execute(
            "UPDATE 待办 SET 事项=?,详情块=?,详情=? WHERE id=? AND 来源=?",
            (标题, json.dumps(块, ensure_ascii=False), _块转镜像(块), rid, 来源))
        con.execute(
            "DELETE FROM 待办关联 WHERE 待办id=? "
            "AND 待办id IN (SELECT id FROM 待办 WHERE id=? AND 来源=?)",
            (rid, rid, 来源))
        for x in 目标.get("关联") or []:
            if not isinstance(x, dict):
                continue
            类型 = str(x.get("关联类型") or x.get("类型") or x.get("type") or "")
            键 = str(x.get("关联键") or x.get("键") or x.get("k") or "")
            if not 类型 or not 键:
                continue
            con.execute(
                "INSERT OR IGNORE INTO 待办关联(待办id,关联类型,关联键,显示文本,创建时间) "
                "SELECT ?,?,?,?,datetime('now','localtime') "
                "WHERE EXISTS(SELECT 1 FROM 待办 WHERE id=? AND 来源=?)",
                (rid, 类型, 键, str(x.get("显示文本") or x.get("文本") or x.get("text") or ""), rid, 来源))
        con.commit()
        return {"ok": True, "缺附件数": 缺附件数}
    finally:
        con.close()

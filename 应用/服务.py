#!/usr/bin/env python3
import errno
import gzip
import json
import os
import re
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote, unquote

应用根 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, 应用根)

import 公用
import AI速记
import 工作视图
import 运动提醒
import 功能开关
from 待办核心 import (
    _待办口, 待办来源集, 待办详情, 待办评论, 待办图片, 待办文件,
    取待办图字节, 取待办文件字节, 建待办, 删待办, 建待办关联, 删待办关联, 改挂关联,
    反查待办, 列待办树, 改待办, 建待办带关联, 待办角标, 搜关联, 关联显示设置接口, 来源集清单, 存待办块,
    归档待办, 批量改待办, 转待办层级, 回收站,
    存待办历史, 列待办历史, 取待办历史, 恢复待办历史, 通用错话, 记错,
)

页面目录 = os.path.join(应用根, "页面")

_门 = None
_资源引用正则 = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"]*)(")', re.IGNORECASE)

_POST路由 = {
    "/api/todo/list": 列待办树,
    "/api/todo/add": 建待办,
    "/api/todo/del": 删待办,
    "/api/todo/trash": 回收站,
    "/api/todo/edit": 改待办,
    "/api/todo/detail": 待办详情,
    "/api/todo/comment": 待办评论,
    "/api/todo/img": 待办图片,
    "/api/todo/file": 待办文件,
    "/api/todo/blocks": 存待办块,
    "/api/todo/link/add": 建待办关联,
    "/api/todo/link/del": 删待办关联,
    "/api/todo/link/repoint": 改挂关联,
    "/api/todo/link/search": 搜关联,
    "/api/todo/link/cols": 关联显示设置接口,
    "/api/todo/by-link": 反查待办,
    "/api/todo/quick-add": 建待办带关联,
    "/api/todo/badge": 待办角标,
    "/api/todo/archive": 归档待办,
    "/api/todo/batch": 批量改待办,
    "/api/todo/reparent": 转待办层级,
    "/api/todo/history/save": 存待办历史,
    "/api/todo/history/list": 列待办历史,
    "/api/todo/history/one": 取待办历史,
    "/api/todo/history/restore": 恢复待办历史,
    "/api/todo/views": 工作视图.工作视图接口,
    "/api/todo/ai-note": AI速记.速记接口,
    "/api/todo/ai-title": AI速记.标题接口,
    "/api/todo/features": 功能开关.功能接口,
    "/api/move": 运动提醒.运动接口,
    "/api/prod/todo/detail": 待办详情,
    "/api/prod/todo/comment": 待办评论,
    "/api/prod/todo/img": 待办图片,
}


def _文字类(类型):
    主 = (类型 or "").split(";")[0].strip().lower()
    return 主.startswith("text/") or 主 in ("application/json", "application/javascript", "image/svg+xml")


def _收gzip(头):
    for 段 in (头 or "").lower().split(","):
        名, *参 = [x.strip() for x in 段.split(";")]
        if 名 in ("gzip", "*"):
            return not any(x.replace(" ", "") in ("q=0", "q=0.0", "q=0.00", "q=0.000") for x in 参)
    return False


_放行端口缓存 = None


def _放行端口():
    global _放行端口缓存
    if _放行端口缓存 is None:
        try:
            _放行端口缓存 = {int(x) for x in (公用.读配置().get("跨站放行端口") or [])}
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            _放行端口缓存 = set()
    return _放行端口缓存


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=页面目录, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        源 = self._放行源()
        if 源:
            self.send_header("Access-Control-Allow-Origin", 源)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    def _发(self, code, body, 类型):
        可压 = len(body) >= 4096 and _文字类(类型)
        压 = 可压 and _收gzip(", ".join(self.headers.get_all("Accept-Encoding") or []))
        if 压:
            body = gzip.compress(body, 6)
        self.send_response(code)
        self.send_header("Content-Type", 类型)
        if 可压:
            self.send_header("Vary", "Accept-Encoding")
        if 压:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._发(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _放行源(self):
        源 = self.headers.get("Origin")
        if not 源:
            return None
        from urllib.parse import urlsplit
        o = urlsplit(源)
        if o.scheme not in ("http", "https") or not o.hostname:
            return None
        本 = urlsplit("//" + (self.headers.get("Host") or ""))
        if o.hostname != 本.hostname:
            return None
        try:
            默认 = 443 if o.scheme == "https" else 80
            端口 = o.port or 默认
            本端口 = 本.port or 默认
        except ValueError:
            return None
        if 端口 == 本端口 or 端口 in _放行端口():
            return 源
        return None

    def _同源(self):
        return not self.headers.get("Origin") or self._放行源() is not None

    def _读体(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def _发HTML盖版本(self, 相对路径):
        文件 = os.path.join(页面目录, 相对路径)
        if not os.path.isfile(文件):
            return False
        try:
            with open(文件, "rb") as f:
                html = f.read()
        except OSError:
            return False

        def 替(m):
            前, 值, 后 = m.group(1), m.group(2), m.group(3)
            if 值.startswith(("http://", "https://", "//", "data:")):
                return m.group(0)
            纯 = 值.split("?", 1)[0]
            if not (纯.endswith(".js") or 纯.endswith(".css")):
                return m.group(0)
            资源 = os.path.join(页面目录, 纯)
            if not os.path.isfile(资源):
                return m.group(0)
            return f"{前}{纯}?v={int(os.path.getmtime(资源))}{后}"

        html = _资源引用正则.sub(替, html.decode("utf-8")).encode("utf-8")
        self._发(200, html, "text/html; charset=utf-8")
        return True

    def _发文字文件(self):
        文件 = self.translate_path(self.path)
        类型 = self.guess_type(文件)
        if not os.path.isfile(文件) or not _文字类(类型):
            return False
        try:
            with open(文件, "rb") as f:
                body = f.read()
        except OSError:
            return False
        if 类型.startswith("text/") or 类型 == "application/javascript":
            类型 += "; charset=utf-8"
        self._发(200, body, 类型)
        return True

    def _过门(self):
        return True


    def do_HEAD(self):
        if not self._过门():
            return
        return super().do_HEAD()

    def do_GET(self):
        if not self._过门():
            return
        _p = unquote(urlparse(self.path).path)

        if _p == "/api/todo/sources":
            return self._json({"ok": True, "来源": 待办来源集(), "来源集": 来源集清单(), "功能": 功能开关.读()})

        if _p in ("/api/model-badge/family", "/api/model-badge/history"):
            q = parse_qs(urlparse(self.path).query)
            名 = q.get("功能名", [""])[0]
            if _p.endswith("family"):
                return self._json(*AI速记.模型牌族(名))
            return self._json(*AI速记.调用历史(名, q.get("软件", [""])[0], q.get("条数", ["20"])[0]))


        if _p == "/api/prod/todo/img":
            q = parse_qs(urlparse(self.path).query)
            r = 取待办图字节(q.get("id", [""])[0], q.get("src", [""])[0])
            if not r:
                return self._json({"ok": False, "error": "图不存在"}, 404)
            数据, mime = r
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(数据)))
            self.end_headers()
            return self.wfile.write(数据)

        if _p == "/api/todo/file":
            q = parse_qs(urlparse(self.path).query)
            r = 取待办文件字节(q.get("id", [""])[0], q.get("src", [""])[0])
            if not r:
                return self._json({"ok": False, "error": "文件不存在"}, 404)
            数据, mime, 原名 = r
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Disposition",
                             "attachment; filename=\"attachment\"; filename*=UTF-8''" + quote(原名))
            self.send_header("Content-Length", str(len(数据)))
            self.end_headers()
            return self.wfile.write(数据)

        if _p in ("/", "/index.html", "/待办.html"):
            if self._发HTML盖版本("待办.html"):
                return
        if _p.endswith(".html") and self._发HTML盖版本(_p.lstrip("/")):
            return
        self.path = quote(_p)
        if self._发文字文件():
            return
        return super().do_GET()

    def do_OPTIONS(self):
        源 = self._放行源()
        if 源 is None:
            return self._json({"ok": False, "error": "跨站请求被拒"}, 403)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        if not self._过门():
            return
        if not self._同源():
            return self._json({"ok": False, "error": "跨站请求被拒"}, 403)
        _p = unquote(urlparse(self.path).path)
        if _p == "/api/model-badge/move":
            return self._json(*AI速记.模型牌挪(self._读体()))
        fn = _POST路由.get(_p)
        if fn is None:
            return self._json({"ok": False, "error": f"没有这个接口:{_p}"}, 404)
        try:
            体 = self._读体()
            return self._json(_待办口(fn, 体))
        except Exception as e:
            import traceback
            traceback.print_exc()
            return self._json({"ok": False, "error": 通用错话, **记错(f"接口兜底 {_p}", e)}, 500)


def _本机局域网IP():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def _取参(名):
    if 名 not in sys.argv:
        return None
    i = sys.argv.index(名)
    if i + 1 >= len(sys.argv) or sys.argv[i + 1].startswith("--"):
        sys.exit(f"启动参数 {名} 后面少了值")
    return sys.argv[i + 1]


def 主():
    命令行数据目录 = _取参("--数据目录")
    配数据目录 = 公用.读配置().get("数据目录")
    数据目录 = 命令行数据目录 or (配数据目录 and os.path.join(公用.应用根, 配数据目录))
    if 数据目录:
        import 建库与迁移
        公用.数据目录 = os.path.abspath(数据目录)
        os.makedirs(公用.数据目录, exist_ok=True)
        print(f"待办库:{建库与迁移.备好库(公用.待办库路径())}", flush=True)
    端口参 = _取参("--端口")
    端口 = int(端口参) if 端口参 else int(公用.读配置().get("端口") or 8899)
    局域网 = "--lan" in sys.argv
    try:
        srv = ThreadingHTTPServer(("0.0.0.0" if 局域网 else "127.0.0.1", 端口), H)
    except OSError as e:
        if e.errno in (errno.EADDRINUSE, getattr(errno, "WSAEADDRINUSE", 10048)):
            sys.exit(f"{端口} 端口被占着(多半是待办已经开着一份):加 --端口 {端口 + 1} 换个号再开")
        sys.exit(f"{端口} 端口开不了:加 --端口 {端口 + 1} 换个号再试(原因:{e})")
    print(f"独立待办 · 这台电脑上开 → http://127.0.0.1:{端口}/", flush=True)
    if 局域网:
        ip = _本机局域网IP()
        if ip:
            print(f"独立待办 · 手机/平板同一个 wifi 开 → http://{ip}:{端口}/", flush=True)
        if _门 is None:
            print("⚠ 同一个 wifi 里任何设备都能打开这一页,而且能改能删 —— 这一页没有口令闸。", flush=True)
    print(f"本机认得的来源:{待办来源集()}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    主()

#!/usr/bin/env python3
"""AI 接入底座 · 设置面板 —— 本机小网页,点一下换模型。

  python3 panel.py                       起服务,浏览器自己打开(库用 ai.py 的默认位置)
  python3 panel.py <配置库或它所在文件夹>  指定库
  python3 panel.py --端口 8899            换个端口
  python3 panel.py --不开                 不自动开浏览器(壳里用这个)
  python3 panel.py --局域网               同 wifi 的手机 / 别的电脑也能开,凭口令进
                                         (口令固定存在库旁边的 局域网口令.txt,起服务时把整条地址打出来;
                                          不加这个参数就跟以前一样只绑 127.0.0.1。
                                          端口也死守:被占就报错退出、不往后挪 —— 手机书签认的是号)
  python3 panel.py --功能声明 <插件.json>  按已装软件补功能，可重复
  python3 panel.py --无已装软件            明确空安装范围
  python3 panel.py --只补功能              配合明确范围补行后退出
  python3 panel.py --自检                 铺一个临时库,把接口全打一遍

这一层只搬数据,一条配置都不在这儿判、不在这儿写 SQL —— 读写全走 ai.py 的
读配置 / 设密钥 / 设路由 / 加供应商 / 加功能 / 问 / 画图。在这儿重写一份连库逻辑,就有了第二份配置真相源,
迟早跟命令行那边对不上(铁律四:配置只有一份)。

谁进得来(`放行()`):起服务就掷一个口令,自动开的那条网址后面带着 `?k=<口令>`,人这边一步没多。
**没带口令的一律挡**(2026-09-04 撤掉了「本机就放行」那条兜底)。挡的就是「你自己浏览器里开着的
任意一个网页,背着你往 127.0.0.1 发 POST 改密钥」这件事:只绑 127.0.0.1 拦不住它,它的 Host
天然就是 127.0.0.1。壳手上没有口令,它读 `起()` 写下的 `面板地址.txt` 进来。不许改的地方在 `放行()` 的注释里。

零第三方依赖(铁律一):只用标准库,页面里也不许引任何 CDN。
不写死路径(铁律二):库路径从启动参数进来,代码里不许出现具体的用户目录。
"""
import argparse
import base64
import csv
import gzip
import hmac
import io
import json
import re
import math
import secrets
import socket
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ai

面板目录 = Path(__file__).resolve().parent / "ui"
静态 = {"/": "index.html", "/index.html": "index.html", "/共用.css": "共用.css",
        "/页眉侧栏.js": "页眉侧栏.js", "/菜单.js": "菜单.js",
        "/模型更新.html": "模型更新.html", "/模型更新.js": "模型更新.js",
        "/表格.js": "表格.js", "/表格.css": "表格.css", "/按供应商.js": "按供应商.js"}
饼名 = "ai_base_k"
请求上限 = 1 << 16


def _真假(值):
    if not isinstance(值, bool):
        raise ValueError("开关只收 true / false")
    return 值


def _非负数(值):
    x = float(0 if 值 in (None, "") else 值)
    if not math.isfinite(x) or x < 0:
        raise ValueError("节流只收 ≥0 的数")
    return x


def _读本机建议(库):
    路径 = Path(库 or ai.库路径()).resolve().parent / "本机建议.json"
    try:
        表 = json.loads(路径.read_text(encoding="utf-8"))
        if not isinstance(表, dict):
            raise ValueError("顶层必须是对象")
        for 名, 项 in 表.items():
            if (not isinstance(项, dict) or not isinstance(项.get("话"), str)
                    or not isinstance(项.get("解"), str)
                    or ("警" in 项 and not isinstance(项["警"], bool))):
                raise ValueError("建议项必须包含文字「话」「解」,「警」限布尔值")
        return 表
    except FileNotFoundError:
        return {}
    except (OSError, UnicodeError, ValueError) as e:
        print(f"本机建议未读取:{e.__class__.__name__}: {e}", file=sys.stderr)
        return {}


def 面板报错(错, 接口):
    号 = "PANEL-" + secrets.token_hex(8).upper()
    时 = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    类 = 错.__class__.__name__
    print(f"面板出错[{号}]({接口}) {时}: {类}: {错}", file=sys.stderr)
    return {"错": "面板读不了设置，重试或复制报错" if 接口 == "/api/state" else "面板操作没成功，重试或复制报错",
            "报错类名": 类, "接口": 接口, "时间": 时, "错误号": 号}


def _文字类(类型: str) -> bool:
    主 = (类型 or "").split(";")[0].strip().lower()
    return 主.startswith("text/") or 主 in ("application/json", "application/javascript", "image/svg+xml")


def _收gzip(头: str | None) -> bool:
    for 段 in (头 or "").lower().split(","):
        名, *参 = [x.strip() for x in 段.split(";")]
        if 名 in ("gzip", "*"):
            return not any(x.replace(" ", "") in ("q=0", "q=0.0", "q=0.00", "q=0.000") for x in 参)
    return False


class 门(BaseHTTPRequestHandler):
    库 = None
    安装范围 = {"已知": False, "功能名": [], "声明错误": [], "声明": []}
    口令 = None
    模型更新锁 = threading.RLock()

    def 模型更新状态(s):
        p = ai.模型更新预览(库=s.库)
        with 门.模型更新锁:
            检查 = getattr(s.server, "模型更新检查", [])
            ai._带检查结果(p, 检查)
            回 = getattr(s.server, "模型更新回执", None)
            p["撤回令牌"] = 回["令牌"] if 回 else ""
            p["撤回数量"] = 回["回执"]["数量"] if 回 else 0
        return p

    def 回(s, 码, 体, 类型="application/json; charset=utf-8", 饼=None, 头=None):
        if not isinstance(体, bytes):
            体 = json.dumps(体, ensure_ascii=False).encode("utf-8")
        可压 = len(体) >= 4096 and _文字类(类型)
        压 = 可压 and _收gzip(", ".join(s.headers.get_all("Accept-Encoding") or []))
        if 压:
            体 = gzip.compress(体, 6)
        s.send_response(码)
        s.send_header("Content-Type", 类型)
        if 可压:
            s.send_header("Vary", "Accept-Encoding")
        if 压:
            s.send_header("Content-Encoding", "gzip")
        s.send_header("Content-Length", str(len(体)))
        if 饼:
            s.send_header("Set-Cookie", 饼)
        for 名, 值 in (头 or {}).items():
            s.send_header(名, 值)
        s.end_headers()
        s.wfile.write(体)

    def 放行(s):
        return bool(门.口令) and hmac.compare_digest(s._给的口令(), 门.口令)

    def 过门(s) -> bool:
        if s.放行():
            return True
        s.回(403, {"错": "口令不对"})
        return False

    def _给的口令(s) -> str:
        给的 = parse_qs(urlparse(s.path).query).get("k", [""])[0]
        if 给的:
            return 给的
        饼们 = {}
        for 块 in (s.headers.get("Cookie") or "").split(";"):
            名, _, 值 = 块.strip().partition("=")
            饼们.setdefault(名, 值)
        return 饼们.get(饼名) or 饼们.get("k", "")

    def do_GET(s):
        if not s.过门():
            return
        路径 = unquote(urlparse(s.path).path)
        if 路径 in 静态:
            f = 面板目录 / 静态[路径]
            if not f.exists():
                return s.回(500, f"面板文件不在:ui/{静态[路径]}".encode("utf-8"),
                            "text/plain; charset=utf-8")
            类型 = ("text/css" if 静态[路径].endswith(".css") else
                  "text/javascript" if 静态[路径].endswith(".js") else "text/html")
            饼 = (f"{饼名}={门.口令}; Path=/; Max-Age=31536000; SameSite=Lax"
                  if 门.口令 else None)
            return s.回(200, f.read_bytes(), f"{类型}; charset=utf-8", 饼)
        if 路径 == "/api/state":
            try:
                资 = ai.读配置(s.库, 日志条数=500)
                资["安装范围"] = ai._安装范围状态(资, 门.安装范围, s.库)
                if 资["安装范围"]["已知"]:
                    名们 = set(资["安装范围"]["功能名"])
                    资["安装范围"]["已成功调用"] = any(
                        ai.历史(f["功能名"], 条数=0, 库=s.库)["成了"] > 0
                        for f in 资["功能"] if f["功能名"] in 名们)
                资["名册"] = ai.名册()
                资["地址尾巴们"] = ai.地址尾巴们()
                资["模型更新"] = s.模型更新状态()
                资["本机建议"] = _读本机建议(s.库)
                return s.回(200, 资)
            except Exception as e:
                return s.回(500, 面板报错(e, 路径))
        if 路径 in ("/api/logs", "/api/logs.csv"):
            问 = parse_qs(urlparse(s.path).query, keep_blank_values=True)
            功能名 = 问.get("功能名", [""])[0]
            失败参数 = 问.get("只看失败", ["0"])[0]
            if 失败参数 not in ("0", "1"):
                return s.回(400, {"错": "只看失败参数限 0 或 1"})
            筛选 = {"日志功能名": 功能名, "日志只看失败": 失败参数 == "1"}
        if 路径 == "/api/logs":
            try:
                跳过 = int(问.get("跳过", ["0"])[0])
                条数 = int(问.get("条数", ["50"])[0])
            except (TypeError, ValueError):
                return s.回(400, {"错": "分页参数必须是整数"})
            if 跳过 < 0 or not 1 <= 条数 <= 200:
                return s.回(400, {"错": "跳过数不能为负,条数限 1 到 200"})
            try:
                资 = ai.读配置(s.库, 日志条数=条数, 日志跳过=跳过, **筛选)
                return s.回(200, {"日志": 资["日志"], "总数": 资["日志总数"]})
            except Exception as e:
                print(f"面板出错({路径}):{e.__class__.__name__}: {e}", file=sys.stderr)
                return s.回(500, {"错": "调用记录没取到,点重试"})
        if 路径 == "/api/logs.csv":
            try:
                资 = ai.读配置(s.库, 日志条数=2 ** 63 - 1, 日志报错全文=True, **筛选)
                缓 = io.StringIO(newline="")
                写 = csv.writer(缓, lineterminator="\r\n")
                写.writerow(["ID", "时刻", "功能", "供应商", "模型", "结果(成/败)", "耗时秒", "推理强度", "报错原文"])
                for g in 资["日志"]:
                    秒 = f"{(g['耗时毫秒'] or 0) / 1000:.3f}".rstrip("0").rstrip(".") or "0"
                    写.writerow([g["ID"], g["时刻"], g["功能"], g["用了谁"], g["模型"],
                                 "成" if g["成没成"] else "败", 秒, g["用力"], g["报错原文"]])
                名 = "调用记录-" + time.strftime("%Y%m%d-%H%M") + ".csv"
                return s.回(200, 缓.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8",
                            头={"Content-Disposition":
                               f"attachment; filename=\"ai-base-logs.csv\"; filename*=UTF-8''{quote(名)}"})
            except Exception as e:
                print(f"面板出错({路径}):{e.__class__.__name__}: {e}", file=sys.stderr)
                return s.回(500, {"错": "调用记录没导出,点重试"})
        s.回(404, {"错": "没这个地址"})

    def do_POST(s):
        if not s.过门():
            return
        路径 = unquote(urlparse(s.path).path)
        if 路径 not in ("/api/key", "/api/route", "/api/try", "/api/provider", "/api/feature",
                        "/api/throttle", "/api/egress", "/api/subscription", "/api/consent",
                        "/api/models", "/api/delfeature", "/api/enable", "/api/effort",
                        "/api/addpreset", "/api/unhide", "/api/hide", "/api/note",
                        "/api/modelnote", "/api/probe", "/api/delprovider",
                        "/api/projectnote", "/api/promote", "/api/move", "/api/effortprobe",
                        "/api/balance", "/api/expiry", "/api/model-updates/check",
                        "/api/model-updates/apply", "/api/model-updates/undo", "/api/model-updates/fixed",
                        "/api/concurrency"):
            return s.回(404, {"错": "没这个地址"})
        try:
            n = int(s.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n < 0:
            return s.回(400, {"错": "请求读不出来"})
        if n > 请求上限:
            return s.回(413, {"错": "发上来的东西太大了"})
        try:
            请求 = json.loads(s.rfile.read(n) or b"{}")
            if not isinstance(请求, dict):
                raise ValueError("顶层得是对象")
        except Exception:
            return s.回(400, {"错": "请求读不出来"})
        try:
            if 路径.startswith("/api/model-updates/"):
                with 门.模型更新锁:
                    if 路径 == "/api/model-updates/check":
                        p = ai.检查模型更新(库=s.库)
                        s.server.模型更新检查 = p["刷新"]
                        return s.回(200, {"成了": True, "模型更新": s.模型更新状态()})
                    if 路径 == "/api/model-updates/fixed":
                        ai.设不提新版(请求.get("功能名"), _真假(请求.get("不提新版")), 库=s.库)
                        return s.回(200, {"成了": True, "模型更新": s.模型更新状态()})
                    if 路径 == "/api/model-updates/apply":
                        if any(x.get("错") for x in getattr(s.server, "模型更新检查", [])):
                            raise ai.底座错误("部分清单未取到，重新检查更新")
                        r = ai.应用模型更新(请求.get("指纹"), 请求.get("选中"), 库=s.库)
                        if r["撤回"]:
                            s.server.模型更新回执 = {"令牌": secrets.token_urlsafe(24), "回执": r["撤回"]}
                        return s.回(200, {"成了": True, "数量": r["数量"], "改名": r["改名"],
                                          "模型更新": s.模型更新状态()})
                    回 = getattr(s.server, "模型更新回执", None)
                    令 = 请求.get("令牌")
                    if not 回 or not isinstance(令, str) or not hmac.compare_digest(令, 回["令牌"]):
                        raise ai.底座错误("撤回凭据已失效，刷新页面")
                    r = ai.撤回模型更新(回["回执"], 库=s.库)
                    s.server.模型更新回执 = None
                    return s.回(200, {"成了": True, "数量": r["数量"], "模型更新": s.模型更新状态()})
            if 路径 == "/api/key":
                名 = str(请求.get("供应商") or "")
                成 = ai.设密钥(名, str(请求.get("密钥") or ""), 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": "存好了" if 成 else f"供应商表里没有「{名}」"})
            if 路径 == "/api/provider":
                照名册 = bool(请求.get("照名册"))
                类型 = str(请求.get("类型") or "")
                地址 = str(请求.get("地址") or "")
                if 类型 == "网页接口" and 地址 and not 照名册:
                    地址 = ai.拼地址(地址)
                怎么了 = ai.加供应商(str(请求.get("名") or ""), 类型,
                                  地址, str(请求.get("模型们") or ""),
                                  str(请求.get("备注") or ""), 库=s.库, 照名册=照名册)
                return s.回(200, {"成了": True, "新建": 怎么了 == "新建",
                                  "说": "加好了" if 怎么了 == "新建" else "本来就有这个名字,改的是原来那一家"})
            if 路径 == "/api/feature":
                怎么了 = ai.加功能(str(请求.get("功能名") or ""), str(请求.get("种类") or ""),
                                str(请求.get("供应商") or ""), str(请求.get("模型") or ""),
                                库=s.库)
                return s.回(200, {"成了": True, "新建": 怎么了 == "新建",
                                  "说": "加好了" if 怎么了 == "新建" else "本来就有这个名字,改的是原来那一行"})
            if 路径 == "/api/models":
                r = ai.问模型清单(str(请求.get("供应商") or ""), 库=s.库)
                走了 = r["不认了"]
                滤 = r.get("滤掉") or []
                return s.回(200, {"成了": True, "清单": r["清单"], "地址": r["地址"], "不认了": 走了,
                                  "说": f"拿回 {len(r['清单'])} 个模型"
                                        + (f";另有 {len(滤)} 个不归这一家(收费的或别家的),没拉进来" if 滤 else "")
                                        + (f";原来清单里有 {len(走了)} 个它现在不认了" if 走了 else "")
                                        + (f";清掉 {len(r['清走'])} 个已失效的旧行" if r["清走"] else "")})
            if 路径 == "/api/unhide":
                回了 = ai.放回(str(请求.get("供应商") or ""), str(请求.get("模型") or ""), 库=s.库)
                return s.回(200, {"成了": 回了,
                                  "说": "已取消隐藏 —— 下次点「拉取模型列表」它就能再露面"
                                        if 回了 else "本来就没藏着这个"})
            if 路径 == "/api/hide":
                新记 = ai.藏(str(请求.get("供应商") or ""), str(请求.get("模型") or ""),
                          str(请求.get("为什么") or ""), 库=s.库)
                return s.回(200, {"成了": True, "新记": 新记,
                                  "说": "已隐藏 —— 下拉框里它还在,但是灰的、选不了"
                                        if 新记 else "备注改好了"})
            if 路径 == "/api/modelnote":
                ai.记笔记(str(请求.get("供应商") or ""), str(请求.get("模型") or ""),
                        备注=请求.get("备注"), 判断=请求.get("判断"), 库=s.库)
                return s.回(200, {"成了": True, "说": "记下了"})
            if 路径 == "/api/probe":
                r = ai.试模型(str(请求.get("供应商") or ""), str(请求.get("模型") or ""), 库=s.库)
                说 = ("通了:" if r["通了"] else "不通:") + r["话"]
                if r["看图说"]:
                    说 += "|" + r["看图说"]
                if r["测速毫秒"] is not None:
                    说 += f"|用时 {r['测速毫秒'] / 1000:.1f} 秒"
                return s.回(200, {"成了": r["通了"], "通了": r["通了"], "测于": r["测于"],
                                  "看图": r["看图"], "看图来源": r["看图来源"],
                                  "测速毫秒": r["测速毫秒"], "说": 说})
            if 路径 == "/api/effortprobe":
                r = ai.探档位(str(请求.get("供应商") or ""), str(请求.get("模型") or ""), 库=s.库)
                说 = {"接口自报": "它认这几档:" + "、".join(r["档们"]),
                     "不吃这一格": "这个模型没有推理强度这一格 —— 发什么它都不理",
                     "探不出来": "问不出来,那一格照旧给候选值:" + r["话"][:120]}
                return s.回(200, {"成了": r["来源"] != "探不出来", "来源": r["来源"],
                                  "档们": r["档们"], "探于": r["探于"],
                                  "说": 说.get(r["来源"], r["话"][:150])})
            if 路径 == "/api/note":
                名 = str(请求.get("功能名") or "")
                if "备注" in 请求:
                    成 = ai.设备注(名, str(请求.get("备注") or ""), 库=s.库)
                else:
                    成 = ai.设说明(名, str(请求.get("说明") or ""), 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": "记下了" if 成 else f"功能表里没有「{名}」这一行"})
            if 路径 == "/api/concurrency":
                名 = str(请求.get("功能名") or "")
                成 = ai.设同时(名, 请求.get("同时"), 库=s.库)
                数 = ai.同时几个(名, 库=s.库)
                return s.回(200, {"成了": True, "同时": 数,
                                  "说": ("没变" if not 成 else
                                        f"同时跑几个改成 {数}" if 数 is not None else "抹掉了,接入方用自己的老数")})
            if 路径 == "/api/projectnote":
                名 = str(请求.get("项目名") or "")
                出 = ai.设项目笔记(
                    名,
                    备注=str(请求["备注"]) if "备注" in 请求 else None,
                    网址=str(请求["网址"]) if "网址" in 请求 else None, 库=s.库)
                return s.回(200, {"成了": True, "说": "记下了", **出})
            if 路径 == "/api/promote":
                顶 = str(请求.get("顶上那行") or "")
                出 = ai.对调设定(str(请求.get("这一档") or ""), 顶, 库=s.库)
                return s.回(200, {"成了": True,
                                  "说": f"提上去了:「{顶}」现在拨给 {出['乙现在']}", **出})
            if 路径 == "/api/move":
                出 = ai.挪一格(str(请求.get("功能名") or ""), str(请求.get("方向") or ""), 库=s.库)
                return s.回(200, {"成了": True,
                                  "说": f"挪好了:这一行现在拨给 {出['甲现在']}", **出})
            if 路径 == "/api/delfeature":
                名 = str(请求.get("功能名") or "")
                成 = ai.删功能(名, 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": f"「{名}」删掉了" if 成
                                        else f"没找到「{名}」这一行 —— 本来就没有,或者已经被别处删掉了"})
            if 路径 == "/api/delprovider":
                名 = str(请求.get("供应商") or "")
                成 = ai.删供应商(名, 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": f"「{名}」这一家删掉了" if 成
                                        else f"没找到「{名}」这一家 —— 本来就没有,或者已经被别处删掉了"})
            if 路径 == "/api/enable":
                名 = str(请求.get("功能名") or "")
                开 = _真假(请求.get("开"))
                成 = ai.设启用(名, 开, 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": ("别的软件那边又能选它了" if 开
                                         else "别的软件那边的下拉框里没有它了,这一行还留着")
                                        if 成 else f"没找到「{名}」这一行"})
            if 路径 == "/api/effort":
                名 = str(请求.get("功能名") or "")
                成 = ai.设用力(名, str(请求.get("用力") or ""), 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": "存好了,下次调用就按这个强度" if 成
                                        else f"没找到「{名}」这一行"})
            if 路径 == "/api/addpreset":
                全名 = ai.加备选(str(请求.get("功能名") or ""),
                               str(请求.get("供应商") or ""),
                               str(请求.get("模型") or ""),
                               str(请求.get("显示名") or ""), 库=s.库)
                return s.回(200, {"成了": True, "全名": 全名, "说": f"加好了:{全名}"})
            if 路径 == "/api/balance":
                r = ai.查余额(str(请求.get("供应商") or ""), 库=s.库)
                return s.回(200, {"成了": True, "说": r["余额"], **r})
            if 路径 == "/api/expiry":
                名 = str(请求.get("供应商") or "")
                成 = ai.设到期日(名, str(请求.get("到期日") or ""), 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": "存好了" if 成 else f"供应商表里没有「{名}」"})
            if 路径 == "/api/throttle":
                名 = str(请求.get("供应商") or "")
                成 = ai.设限速(名, _非负数(请求.get("最小间隔秒")),
                              int(_非负数(请求.get("每小时上限"))), 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": "存好了" if 成 else f"供应商表里没有「{名}」"})
            if 路径 == "/api/subscription":
                名 = str(请求.get("供应商") or "")
                成 = ai.设吃订阅(名, _真假(请求.get("吃订阅")), 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": "存好了" if 成 else f"供应商表里没有「{名}」"})
            if 路径 == "/api/consent":
                名 = str(请求.get("供应商") or "")
                开 = _真假(请求.get("开"))
                成 = ai.设同意(名, 开, 库=s.库)
                return s.回(200, {"成了": 成,
                                  "说": ("开了,现在拨得动了" if 开 else "关了,再拨会被拦下")
                                        if 成 else f"供应商表里没有「{名}」"})
            if 路径 == "/api/egress":
                return s.回(200, ai.查出口(库=s.库))
            if 路径 == "/api/route":
                回 = {}
                成 = ai.设路由(str(请求.get("功能名") or ""),
                              str(请求.get("供应商") or ""),
                              str(请求.get("模型") or "") or None, 库=s.库, 回执=回)
                return s.回(200, {"成了": 成, "全名": 回.get("全名", ""), "改名": 回.get("改名", {}),
                                  "说": "存好了" if 成 else "功能表里没有这一行"})
            return s.回(200, 试一下(s.库, str(请求.get("功能名") or "")))
        except ai.底座错误 as e:
            return s.回(200, {"成了": False, "说": str(e)})
        except (ValueError, TypeError) as e:
            return s.回(400, {"错": f"参数不对:{e}"})
        except Exception as e:
            return s.回(500, 面板报错(e, 路径))

    def log_message(s, *a):
        pass


def _量尺寸(图: bytes) -> str:
    if 图[:8] == b"\x89PNG\r\n\x1a\n":
        if len(图) < 24:
            return ""
        宽, 高 = struct.unpack(">II", 图[16:24])
        return f"{宽}×{高},"
    if 图[:2] != b"\xff\xd8":
        return ""
    位 = 2
    while 位 + 9 < len(图):
        if 图[位] != 0xFF:
            位 += 1
            continue
        记号 = 图[位 + 1]
        if 记号 in (0xC0, 0xC1, 0xC2, 0xC3):
            高, 宽 = struct.unpack(">HH", 图[位 + 5:位 + 9])
            return f"{宽}×{高},"
        if 记号 == 0xD8 or 0xD0 <= 记号 <= 0xD9:
            位 += 2
            continue
        位 += 2 + struct.unpack(">H", 图[位 + 2:位 + 4])[0]
    return ""


def 试一下(库, 功能名):
    那行 = next((f for f in ai.读配置(库, 日志条数=0)["功能"] if f["功能名"] == 功能名), None)
    起 = time.time()
    回执 = {}
    try:
        if (那行 or {}).get("种类") == "生图":
            图, 格式 = ai.画图(功能名, "一颗放在白色桌面上的红苹果,正面,写实",
                             超时=120, 重试=0, 回执=回执, 库=库)
            return {"成了": True, "图": base64.b64encode(图).decode("ascii"), "格式": 格式,
                    "说": f"{time.time() - 起:.1f} 秒",
                    "详": f"{_量尺寸(图)}{len(图) / 1048576:.1f} MB", "回执": 回执}
        答 = ai.问(功能名, "你是一个助手,直接回答,不要客套。",
                  "用一句话说明你是谁、你是哪个模型。", 超时=60, 重试=0, 回执=回执, 库=库)
        return {"成了": True, "说": 答.strip()[:300], "回执": 回执}
    except ai.底座错误 as e:
        return {"成了": False, **_没通人话(e)}


def _没通人话(e) -> dict:
    原 = str(e)
    if isinstance(e, (ai.缺配置, ai.功能未登记, ai.机密拒拨, ai.撞上限)):
        return {"说": re.split(r"[。:\n]", 原.strip(), maxsplit=1)[0].strip(), "详": 原[:600], "原文": 原[:600]}
    if isinstance(e, ai.连不上):
        return {"说": "连不上对面,先查网络或这家服务在不在", "原文": 原[:300]}
    return {"说": "对面回了报错,原文点 ⧉ 复制报错看", "原文": 原[:300]}


def 绑(端口, 主机="127.0.0.1", 死守=False):
    for 试 in ([端口] if 死守 else list(range(端口, 端口 + 10)) + [0]):
        try:
            return ThreadingHTTPServer((主机, 试), 门)
        except OSError:
            continue
    if 死守:
        raise SystemExit(f"⚠ {端口} 被别的程序占着;--局域网 不挪号(手机书签认的是这个号),退出等它空出来再起")
    raise SystemExit(f"从 {端口} 往后连系统派号都绑不上,面板起不来")


def 局域网地址():
    import socket
    c = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        c.connect(("8.8.8.8", 80))
        return c.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        c.close()


def 新口令() -> str:
    return "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(8))


def 认口令(库) -> str:
    文 = Path(库).parent / "局域网口令.txt"
    旧 = 文.read_text(encoding="utf-8").strip() if 文.exists() else ""
    if 旧:
        return 旧
    新 = 新口令()
    文.write_text(新 + "\n", encoding="utf-8")
    try:
        文.chmod(0o600)
    except OSError:
        pass
    return 新


def 开门(库, 局域网=False) -> str:
    门.口令 = 认口令(库) if 局域网 else 新口令()
    return 门.口令


def 起(库, 端口, 开浏览器=True, 局域网=False, 功能声明=None):
    门.安装范围 = ai._同步安装声明(功能声明, str(库))
    门.库 = str(库)
    for v in ai.机密违规(库=str(库)):
        print(f"敏感内容违规:「{v['族']}」底下「{v['功能名']}」拨的是 {v['供应商']}/{v['模型']}"
              "(调用时会跳过,删不删你定)", file=sys.stderr)
    开门(库, 局域网)
    服务 = 绑(端口, "0.0.0.0" if 局域网 else "127.0.0.1", 死守=局域网)
    真口 = 服务.server_address[1]
    网址 = f"http://127.0.0.1:{真口}/" + (f"?k={门.口令}" if 门.口令 else "")
    地址文 = Path(库).parent / "面板地址.txt"
    地址文.write_text(网址 + "\n", encoding="utf-8")
    try:
        地址文.chmod(0o600)
    except OSError:
        pass
    print(f"AI_BASE_PORT={真口}", flush=True)
    if 真口 != 端口:
        print(f"⚠ {端口} 被别的程序占着,改用 {真口}", flush=True)
    print(f"设置面板起来了:{网址}\n库:{门.库}\n按 Ctrl+C 关掉", flush=True)
    if 局域网:
        print(f"手机 / 别的电脑在同一个 wifi 上开这个:http://{局域网地址()}:{真口}/?k={门.口令}"
              f"\n口令 {门.口令} 只用打这一次,浏览器记一年;它守着库里的 API key,别发到群里。",
              flush=True)
    if 开浏览器:
        threading.Timer(0.4, lambda: __import__("webbrowser").open(网址)).start()
    try:
        服务.serve_forever()
    except KeyboardInterrupt:
        print("\n关了。")
    finally:
        服务.server_close()
    return 0


def 认库(给的) -> str:
    if not 给的:
        return ai.库路径()
    p = Path(给的).expanduser()
    if p.suffix != ".db" and not p.is_file():
        if not p.parent.is_dir():
            raise SystemExit(f"这个位置的上一级文件夹不存在:{p.parent}\n"
                             f"库只在已经存在的文件夹底下建最后一级。先看看路径是不是打错了;"
                             f"真要新建整条路径,自己 mkdir -p 出来再起面板。")
        p.mkdir(exist_ok=True)
    return str(p / "配置.db" if p.is_dir() else p)


def 自检():
    import shutil
    import tempfile
    import urllib.request

    增强 = tempfile.TemporaryDirectory(prefix="底座面板自检-增强-")
    ai._自检铺本机增强(增强.name)
    sys.path.insert(0, str(Path(__file__).resolve().parent / "tests"))
    from test_installed_features import run_panel
    run_panel()
    门.安装范围 = ai._读安装声明(None)
    过 = []

    def 查(名, 条件):
        过.append((名, bool(条件)))
        print(("  ✓ " if 条件 else "  ✗ ") + 名)

    临 = Path(tempfile.mkdtemp(prefix="底座面板自检-"))
    try:
        查("库路径差最后一级,自己补得出来(壳给的 <用户根>/ai-base 用户第一次装完就是这样)",
           认库(str(临 / "ai-base")) == str(临 / "ai-base" / "配置.db")
           and (临 / "ai-base").is_dir())
        少两级 = 临 / "打错的一层" / "ai-base"
        try:
            认库(str(少两级))
            报了 = ""
        except SystemExit as e:
            报了 = str(e)
        查("差两级就明说路径不对,不许顺着建出第二份库(铁律四)",
           "上一级文件夹不存在" in 报了 and not 少两级.exists()
           and not (临 / "打错的一层").exists())
        门.库 = str(临 / "配置.db")
        门.口令 = 自检口令 = "zz9test9"
        服务 = ThreadingHTTPServer(("127.0.0.1", 0), 门)
        端口 = 服务.server_address[1]
        threading.Thread(target=服务.serve_forever, daemon=True).start()
        底 = f"http://127.0.0.1:{端口}"

        def 拿(路径, 数据=None):
            req = urllib.request.Request(
                底 + 路径,
                data=None if 数据 is None else json.dumps(数据).encode("utf-8"),
                headers={"Content-Type": "application/json", "Cookie": f"k={门.口令}"})
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read())

        def 裸拿(路径, 体=b"", 头=None, 方法="POST"):
            import http.client
            c = http.client.HTTPConnection("127.0.0.1", 端口, timeout=15)
            c.putrequest(方法, 路径)
            for k, v in {"Content-Type": "application/json", "Cookie": f"k={门.口令}",
                         "Content-Length": str(len(体)), **(头 or {})}.items():
                c.putheader(k, v)
            c.endheaders(体)
            r = c.getresponse()
            return r.status, json.loads(r.read() or b"{}")

        def 原拿(路径, 带口令=True, 头=None):
            import http.client
            c = http.client.HTTPConnection("127.0.0.1", 端口, timeout=15)
            c.putrequest("GET", 路径, skip_accept_encoding=True)
            if 带口令:
                c.putheader("Cookie", f"{饼名}={门.口令}")
            for k, v in (头 or {}).items():
                c.putheader(k, v)
            c.endheaders()
            r = c.getresponse()
            return r.status, dict(r.getheaders()), r.read()

        print("\n面板自检 · 铺一个临时库,把接口全打一遍")
        全 = 拿("/api/state")
        码, 头, 文 = 原拿("/api/state", 头={"Accept-Encoding": "gzip, deflate"})
        查("带 Accept-Encoding: gzip 拿 /api/state 回压过的、解开就是同一份 JSON",
           码 == 200 and 头.get("Content-Encoding") == "gzip" and 头.get("Vary") == "Accept-Encoding"
           and int(头.get("Content-Length")) == len(文)
           and json.loads(gzip.decompress(文).decode("utf-8")).keys() == 全.keys())
        码, 头, 文 = 原拿("/api/state")
        查("不带 Accept-Encoding 原样回", 码 == 200 and "Content-Encoding" not in 头 and json.loads(文).keys() == 全.keys())
        码, 头, 文 = 原拿(quote("/共用.css"), 头={"Accept-Encoding": "gzip"})
        查("静态 CSS 也压、类型照旧 text/css", 头.get("Content-Encoding") == "gzip"
           and 头.get("Content-Type", "").startswith("text/css") and len(gzip.decompress(文)) > 4096)
        码, 头, _ = 原拿("/api/state", 头={"Accept-Encoding": "gzip;q=0, identity"})
        查("gzip;q=0 = 不要压", "Content-Encoding" not in 头)
        查("判压的两个小函数", _文字类("text/javascript") and _文字类("application/json; charset=utf-8")
           and not _文字类("image/png") and _收gzip("br, gzip") and _收gzip("*") and not _收gzip("deflate")
           and not _收gzip(None))
        查("没有本机建议文件时回空表", 全["本机建议"] == {})
        建议文件 = 临 / "本机建议.json"
        示例建议 = {"示例 · 功能": {"话": "💡 示例建议,仅用于测试", "解": "这是假数据", "警": True}}
        建议文件.write_text(json.dumps(示例建议, ensure_ascii=False), encoding="utf-8")
        查("本机建议从临时库旁读取", 拿("/api/state")["本机建议"] == 示例建议)
        建议文件.write_text("{坏 JSON", encoding="utf-8")
        码, _, 原 = 原拿("/api/state")
        查("坏 JSON 不报 500、建议回空表", 码 == 200 and json.loads(原)["本机建议"] == {})
        建议文件.unlink()
        查("备选上限随 /api/state 下发(页面上那个 3 吃它,前端不再自己写一份)",
           全["预设上限"] == ai.预设上限)
        查("每行都带「父功能」那一格(页面分组吃它)",
           all("父功能" in f for f in 全["功能"]))
        查("供应商列得出来(三家)", len(全["供应商"]) == 3)
        查("免费试通那家(Groq)也在出厂库里,且密钥是空的",
           all(any(x["名"] == 名 and x["要密钥"] and not x["有密钥"] and x["免费"]
                   for x in 全["供应商"]) for 名 in ai._出厂照名册))
        查("功能列得出来(两行)", len(全["功能"]) == 2)
        DS = next(x for x in 全["供应商"] if x["名"] == "DeepSeek")
        CL = next(x for x in 全["供应商"] if x["名"] == ai._测CL)
        查("网页接口那家要填 key、现在还没填", DS["要密钥"] and not DS["有密钥"])
        查("命令行那家不要 key", not CL["要密钥"])
        查("模型清单发给前端了(下拉框吃它)", len(DS["模型们"]) >= 2 and len(CL["模型们"]) >= 2)
        查("命令行那家报了本机可用不可用", isinstance(CL["本机可用"], bool))

        免 = next(x for x in 全["供应商"] if x["名"] == ai._出厂照名册[0])
        查("出厂库里按次付费的家只有 DeepSeek 一个(引导第 1 件盯的就是这一类)",
           [x["名"] for x in 全["供应商"] if not x["吃订阅"] and not x["免费"]] == ["DeepSeek"])
        查("出厂免费那一家是免费档,且没被当成按次付费(引导第 1 件不认它)",
           免["免费"] and not 免["吃订阅"])
        查("免费档出厂密钥也是空的(一个 key 都不许进安装包)",
           免["要密钥"] and not 免["有密钥"])
        查("免费档的模型清单发下来了(拨不动时人得能在下拉框里换下一个)",
           len(免["模型们"]) >= 2)
        查("出厂时它的密钥是空的 —— 所以引导第 1 件一开始必然没办完",
           DS["要密钥"] and not DS["有密钥"])
        查("另一家是烧订阅的、且还没点过开启(引导不许把它算成「按次付费」)",
           CL["吃订阅"] and not CL["已同意"])
        查("两条出厂功能都启用着、都指着 DeepSeek(引导第 2 件数的就是它们)",
           all(f["启用"] and f["主用供应商"] == "DeepSeek" for f in 全["功能"]))
        查("出厂时一条日志都没有 —— 所以引导第 3 件一开始必然没办完", 全["日志"] == [])
        查("引导要读的六个字段 /api/state 全带着(少一个页面就画不出来)",
           all(k in DS for k in ("吃订阅", "免费", "已同意", "要密钥", "有密钥", "本机可用"))
           and all(k in 全["功能"][0] for k in ("启用", "主用供应商")))

        记 = ai.连库(门.库)
        for i in range(3):
            ai._记日志(记, f"自检 · 日志{i}", "测 · 家", "m", i != 1, time.time(),
                    '逗号,引号"\n换行' if i == 1 else "", i, "high")
        记.close()
        分页址 = quote("/api/logs?跳过=0&条数=2", safe="/?=&")
        查("日志分页不带口令会被拒绝", 挡住了吗(底, 分页址))
        分 = 拿(quote("/api/logs?跳过=1&条数=2", safe="/?=&"))
        查("带口令能按页取日志，并带全库总数",
           len(分["日志"]) == 2 and 分["日志"][0]["功能"] == "自检 · 日志1"
           and 分["总数"] >= 3)
        码, _, _ = 原拿(quote("/api/logs?跳过=x&条数=2", safe="/?=&"))
        查("日志分页的参数不是整数就回 400", 码 == 400)
        越界码 = [原拿(quote(x, safe="/?=&"))[0] for x in
                 ("/api/logs?跳过=-1&条数=2", "/api/logs?跳过=0&条数=0",
                  "/api/logs?跳过=0&条数=201")]
        查("日志分页限跳过数不为负、每页 1 到 200 条", 越界码 == [400, 400, 400])
        码, _, _ = 原拿("/api/logs.csv", 带口令=False)
        查("日志 CSV 不带口令会被拒绝", 码 == 403)
        码, 头, 文 = 原拿("/api/logs.csv")
        查("带口令能导出 CSV，带 BOM 与指定头行",
           码 == 200 and 文.startswith(b"\xef\xbb\xbf")
           and 文.decode("utf-8-sig").splitlines()[0]
               == "ID,时刻,功能,供应商,模型,结果(成/败),耗时秒,推理强度,报错原文"
           and 头.get("Content-Type") == "text/csv; charset=utf-8"
           and 'filename="ai-base-logs.csv"' in 头.get("Content-Disposition", "")
           and "filename*=UTF-8''" in 头.get("Content-Disposition", ""))

        记 = ai.连库(门.库)
        for 成 in (True, False):
            ai._记日志(记, "自检 · 日志1", "测 · 家", "m", 成, time.time(), "" if 成 else "错")
        记.close()
        for 参数, 应数 in (({"功能名": "自检 · 日志1"}, 3), ({"只看失败": "1"}, 2),
                         ({"功能名": "自检 · 日志1", "只看失败": "1"}, 2),
                         ({"功能名": "不存在' OR 1=1 --", "只看失败": "1"}, 0)):
            询 = urlencode(参数)
            分 = 拿("/api/logs?" + urlencode({"条数": 200}) + "&" + 询)
            码, _, 文 = 原拿("/api/logs.csv?" + 询)
            行们 = list(csv.reader(io.StringIO(文.decode("utf-8-sig"))))[1:]
            查(f"日志筛选 {参数}:JSON、总数与 CSV 都是 {应数} 条",
               码 == 200 and len(分["日志"]) == 分["总数"] == len(行们) == 应数)
            查("筛选后的 JSON 与 CSV 的 ID、功能、成败顺序一致(首列 ID = RZ 号)",
               [(r["ID"], r["功能"], "成" if r["成没成"] else "败") for r in 分["日志"]]
               == [(r[0], r[2], r[5]) for r in 行们]
               and all(re.fullmatch(r"RZ\d{4,}", r[0]) for r in 行们))
        分 = 拿("/api/logs?" + urlencode({"功能名": "自检 · 日志1", "只看失败": "1", "跳过": 1, "条数": 1}))
        查("筛选分页只截行,总数仍为 2", len(分["日志"]) == 1 and 分["总数"] == 2)
        查("两条日志口都拒绝错误的失败参数",
           all(原拿(路径 + "?" + urlencode({"只看失败": "x"}))[0] == 400
               for 路径 in ("/api/logs", "/api/logs.csv")))

        查("存密钥", 拿("/api/key", {"供应商": "DeepSeek", "密钥": "sk-zijian"})["成了"])
        全2 = 拿("/api/state")
        查("存完刷新,状态变成「已填」",
           next(x for x in 全2["供应商"] if x["名"] == "DeepSeek")["有密钥"])
        查("密钥原文一个字节都不回浏览器",
           "sk-zijian" not in json.dumps(全2, ensure_ascii=False))
        查("供应商名瞎写,当场说没这家、不新建",
           not 拿("/api/key", {"供应商": "根本没这家", "密钥": "x"})["成了"])

        查("面板上填到期日", 拿("/api/expiry", {"供应商": "DeepSeek", "到期日": "2026-10-01"})["成了"])
        查("到期日刷新还在",
           next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")["到期日"] == "2026-10-01")
        坏期 = 拿("/api/expiry", {"供应商": "DeepSeek", "到期日": "10月1日"})
        查("到期日格式乱的挡下并说清怎么写", not 坏期["成了"] and "2026-10-01" in 坏期["说"])
        查("到期日能抹空", 拿("/api/expiry", {"供应商": "DeepSeek", "到期日": ""})["成了"]
           and next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")["到期日"] == "")
        查("到期日名字瞎写要挡下",
           not 拿("/api/expiry", {"供应商": "根本没这家", "到期日": "2026-10-01"})["成了"])
        查("每家都带着余额那几格",
           all({"余额", "余额于", "到期日", "查得了余额", "用量页"} <= set(x) for x in 拿("/api/state")["供应商"]))
        没口 = 拿("/api/balance", {"供应商": "Groq"})
        查("没有余额接口的家点查余额 = 当场说没有,不发请求", not 没口["成了"] and "console.groq.com" in 没口["说"])

        查("面板上设节流", 拿("/api/throttle", {"供应商": "DeepSeek",
                                               "最小间隔秒": 2.5, "每小时上限": 50})["成了"])
        那家 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")
        查("刷新一次,设的节流还在",
           那家["最小间隔秒"] == 2.5 and 那家["每小时上限"] == 50)
        查("节流填 0 就是不限", 拿("/api/throttle", {"供应商": "DeepSeek",
                                                   "最小间隔秒": 0, "每小时上限": 0})["成了"])
        那家 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")
        查("清回 0 之后确实是 0",
           那家["最小间隔秒"] == 0 and 那家["每小时上限"] == 0)
        查("给不存在的一家设节流,当场说没这家",
           not 拿("/api/throttle", {"供应商": "根本没这家",
                                    "最小间隔秒": 1, "每小时上限": 1})["成了"])

        查("面板上勾「吃订阅」", 拿("/api/subscription", {"供应商": "DeepSeek", "吃订阅": True})["成了"])
        查("刷新一次,勾还在",
           next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")["吃订阅"])
        查("取消勾也存得进", 拿("/api/subscription", {"供应商": "DeepSeek", "吃订阅": False})["成了"])
        查("取消之后确实是不吃订阅",
           not next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")["吃订阅"])
        查("命令行那家默认就标着吃订阅",
           next(x for x in 拿("/api/state")["供应商"] if x["名"] == ai._测CL)["吃订阅"])
        查("给不存在的一家勾,当场说没这家",
           not 拿("/api/subscription", {"供应商": "根本没这家", "吃订阅": True})["成了"])
        拿("/api/provider", {"名": "测 · 本机反代", "类型": "网页接口",
                             "地址": "http://127.0.0.1:9999/v1/chat/completions"})
        查("新加一家本机地址的,自动标上「吃订阅」",
           next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 本机反代")["吃订阅"])
        拿("/api/provider", {"名": "测 · 外网家", "类型": "网页接口",
                             "地址": "https://api.example.com/v1/chat/completions"})
        查("外网地址那家不乱标风险",
           not next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 外网家")["吃订阅"])
        拿("/api/subscription", {"供应商": "测 · 本机反代", "吃订阅": False})
        拿("/api/provider", {"名": "测 · 本机反代", "类型": "网页接口",
                             "地址": "http://127.0.0.1:8888/v1/chat/completions"})
        查("改一家已有的,不许把人手动调过的标记冲回去",
           not next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 本机反代")["吃订阅"])

        拿("/api/provider", {"名": "测 · 订阅家", "类型": "网页接口",
                             "地址": "http://127.0.0.1:1/v1/chat/completions",
                             "模型们": "m-订"})
        拿("/api/key", {"供应商": "测 · 订阅家", "密钥": "sk-dingyue"})
        拿("/api/feature", {"功能名": "测 · 订阅活", "种类": "文本", "供应商": "测 · 订阅家"})
        订 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 订阅家")
        查("吃订阅那家装完默认是关着的", 订["吃订阅"] and not 订["已同意"])
        没开 = 拿("/api/try", {"功能名": "测 · 订阅活"})
        查("没开就调它:当场拦下,给的是人话不是报错栈",
           not 没开["成了"] and "还没开启" in 没开["说"])
        查("拦下的那句得告诉人去哪儿开(整段在「详」,页面放悬浮)", "面板" in 没开["详"])
        查("没通时「说」只放一句,整段原文进「原文」给复制钮", "\n" not in 没开["说"] and 没开["原文"].startswith(没开["说"]))
        查("面板上点「我知道有账号风险,开启」", 拿("/api/consent", {"供应商": "测 · 订阅家", "开": True})["成了"])
        开了 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 订阅家")
        查("刷新一次,开着的状态还在,而且记下了什么时候开的", bool(开了["已同意"]))
        通 = 拿("/api/try", {"功能名": "测 · 订阅活"})
        查("开了之后闸就不拦了(这次卡在连不上,正说明真发出去了)",
           not 通["成了"] and "还没开启" not in 通["说"])
        查("能关回去", 拿("/api/consent", {"供应商": "测 · 订阅家", "开": False})["成了"])
        又拦 = 拿("/api/try", {"功能名": "测 · 订阅活"})
        查("关回去之后立刻又拨不动", not 又拦["成了"] and "还没开启" in 又拦["说"])
        拿("/api/subscription", {"供应商": "测 · 订阅家", "吃订阅": False})
        没闸 = 拿("/api/try", {"功能名": "测 · 订阅活"})
        查("取消「吃订阅」之后这一家就不受闸管了(页面上取消要先过一次确认)",
           not 没闸["成了"] and "还没开启" not in 没闸["说"])
        拿("/api/subscription", {"供应商": "测 · 订阅家", "吃订阅": True})
        查("标回吃订阅,闸立刻又管上了",
           "还没开启" in 拿("/api/try", {"功能名": "测 · 订阅活"})["说"])
        拿("/api/consent", {"供应商": "测 · 订阅家", "开": True})
        拿("/api/subscription", {"供应商": "测 · 订阅家", "吃订阅": False})
        拿("/api/subscription", {"供应商": "测 · 订阅家", "吃订阅": True})
        回 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 订阅家")
        查("取消勾再标回来,同意得重新点一次,不许自动还原", not 回["已同意"])
        查("所以这时候它又是拨不动的",
           "还没开启" in 拿("/api/try", {"功能名": "测 · 订阅活"})["说"])
        查("按次付费那家没有这个闸,不受影响",
           not next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")["吃订阅"])
        查("给不存在的一家开,当场说没这家",
           not 拿("/api/consent", {"供应商": "根本没这家", "开": True})["成了"])

        次 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")
        查("每家都带着「今天调了几次」这一格", isinstance(次["今天次数"], int))
        查("一次没调过的那家是 0",
           next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 外网家")["今天次数"] == 0)
        前 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 订阅家")["今天次数"]
        汇前 = 拿("/api/state")["汇总"]
        查("/api/state 带着顶部四格,四个都是整数",
           set(汇前) == {"今日调用", "总调用", "今日错误", "总错误"}
           and all(isinstance(v, int) for v in 汇前.values()))
        拿("/api/consent", {"供应商": "测 · 订阅家", "开": True})
        拿("/api/try", {"功能名": "测 · 订阅活"})
        后 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 订阅家")["今天次数"]
        查("调一次之后,这一格当场 +1(败的也算)", 后 == 前 + 1)
        汇后 = 拿("/api/state")["汇总"]
        查("连不上的那一次,顶部四格一起 +1(调用和错误,今天和一共)",
           all(汇后[k] == 汇前[k] + 1 for k in 汇前))
        拿("/api/consent", {"供应商": "测 · 订阅家", "开": False})
        拿("/api/try", {"功能名": "测 · 订阅活"})
        又 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 订阅家")["今天次数"]
        查("被闸拦下的那次不算数 —— 它根本没发出去", 又 == 后)
        查("被闸拦下的那次,顶部四格也不动", 拿("/api/state")["汇总"] == 汇后)

        查("换供应商和模型", 拿("/api/route", {"功能名": "示例 · 生成",
                                              "供应商": ai._测CL, "模型": "opus"})["成了"])
        那行 = next(x for x in 拿("/api/state")["功能"] if x["功能名"] == "示例 · 生成")
        查("刷新一次,换过的还在(判据)",
           那行["主用供应商"] == ai._测CL and 那行["主用模型"] == "opus")
        查("只换模型、不动供应商", 拿("/api/route", {"功能名": "示例 · 生成",
                                                    "供应商": ai._测CL, "模型": "sonnet"})["成了"])
        那行 = next(x for x in 拿("/api/state")["功能"] if x["功能名"] == "示例 · 生成")
        查("刷新一次,新模型还在", 那行["主用模型"] == "sonnet")
        查("指向一个不存在的供应商会被挡下",
           not 拿("/api/route", {"功能名": "示例 · 生成", "供应商": "根本没这家"})["成了"])
        查("挡下之后配置没被改坏",
           next(x for x in 拿("/api/state")["功能"]
                if x["功能名"] == "示例 · 生成")["主用供应商"] == ai._测CL)
        查("功能名瞎写,当场说没这行、不新建",
           not 拿("/api/route", {"功能名": "根本没这个功能", "供应商": "DeepSeek"})["成了"])
        ai.设机密("示例 · 生成", True, 库=门.库)
        拒 = 拿("/api/route", {"功能名": "示例 · 生成", "供应商": "DeepSeek", "模型": "deepseek-flash"})
        查("带敏感内容标的功能换到 DeepSeek 被拒,回中文一句",
           not 拒["成了"] and "只许用 Claude" in 拒.get("说", ""))
        密态 = 拿("/api/state")
        查("被拒后没改库、这一行带着机密标、违规清单是空的",
           next(x for x in 密态["功能"] if x["功能名"] == "示例 · 生成")["主用供应商"] == ai._测CL
           and next(x for x in 密态["功能"] if x["功能名"] == "示例 · 生成")["客户机密"]
           and 密态["机密违规"] == [])
        ai.设机密("示例 · 生成", False, 库=门.库)
        并 = 拿("/api/concurrency", {"功能名": "示例 · 生成", "同时": "4"})
        查("同时跑几个改成 4,状态与 ai.同时几个 都回 4",
           并["成了"] and 并["同时"] == 4 and ai.同时几个("示例 · 生成", 库=门.库) == 4
           and next(x for x in 拿("/api/state")["功能"] if x["功能名"] == "示例 · 生成")["同时"] == 4)
        坏并 = 拿("/api/concurrency", {"功能名": "示例 · 生成", "同时": "0"})
        查("同时跑几个给 0 被拒,回中文一句,库里还是 4",
           not 坏并["成了"] and "1~64" in 坏并.get("说", "") and ai.同时几个("示例 · 生成", 库=门.库) == 4)
        查("同时跑几个清空 = 回到没设",
           拿("/api/concurrency", {"功能名": "示例 · 生成", "同时": ""})["同时"] is None)

        加 = 拿("/api/provider", {"名": "测 · 新家", "类型": "网页接口",
                                  "地址": "http://127.0.0.1:1/v1/chat/completions",
                                  "模型们": "m-一,m-二", "备注": "自检加的"})
        查("加一家新的供应商", 加["成了"] and 加["新建"])
        全3 = 拿("/api/state")
        新家 = next((x for x in 全3["供应商"] if x["名"] == "测 · 新家"), None)
        查("刷新一次,新加的那家还在(判据)", 新家 is not None)
        查("新加的那家要填 key、现在还没填", 新家 and 新家["要密钥"] and not 新家["有密钥"])
        查("模型清单拆开了,下拉框吃得到", 新家 and 新家["模型们"] == ["m-一", "m-二"])
        查("新加的那家能被功能拨过去",
           拿("/api/route", {"功能名": "示例 · 润色",
                             "供应商": "测 · 新家", "模型": "m-一"})["成了"])
        查("拨过去之后刷新还在",
           next(x for x in 拿("/api/state")["功能"]
                if x["功能名"] == "示例 · 润色")["主用供应商"] == "测 · 新家")
        拿("/api/key", {"供应商": "测 · 新家", "密钥": "sk-biemowo"})
        又 = 拿("/api/provider", {"名": "测 · 新家", "类型": "网页接口",
                                  "地址": "http://127.0.0.1:2/v1/chat/completions"})
        查("同名再加一次:说改的是原来那一家,不是新建", 又["成了"] and not 又["新建"])
        全4 = 拿("/api/state")
        查("同名不许多出一行", len([x for x in 全4["供应商"] if x["名"] == "测 · 新家"]) == 1)
        改后 = next(x for x in 全4["供应商"] if x["名"] == "测 · 新家")
        查("改的是网址", 改后["地址"].endswith(":2/v1/chat/completions"))
        查("改网址不许把已存的密钥抹掉", 改后["有密钥"])
        查("模型清单留空 = 不改,不许抹", 改后["模型们"] == ["m-一", "m-二"])
        查("名字空着,当场给人话不给报错栈",
           not 拿("/api/provider", {"名": "", "类型": "网页接口", "地址": "http://x"})["成了"])
        坏类型 = 拿("/api/provider", {"名": "测 · 坏", "类型": "外星协议", "地址": "http://x"})
        查("类型瞎写,当场给人话不给报错栈", not 坏类型["成了"] and "类型只能是" in 坏类型["说"])
        查("参数不合格时不许留下半拉行",
           not any(x["名"] == "测 · 坏" for x in 拿("/api/state")["供应商"]))
        拿("/api/provider", {"名": "测 · 新命令行", "类型": "命令行", "地址": "这个命令不存在-zzz"})
        查("新加的命令行那家,本机装没装照样判得出",
           not next(x for x in 拿("/api/state")["供应商"]
                    if x["名"] == "测 · 新命令行")["本机可用"])
        查("命令行那家的地址是命令名,不许被接上 /chat/completions",
           next(x for x in 拿("/api/state")["供应商"]
                if x["名"] == "测 · 新命令行")["地址"] == "这个命令不存在-zzz")

        拿("/api/provider", {"名": "测 · 半截网址", "类型": "网页接口",
                             "地址": "http://127.0.0.1:1", "模型们": "m-半"})
        查("网址只填半截,存进去的是补全了的那一串",
           next(x for x in 拿("/api/state")["供应商"]
                if x["名"] == "测 · 半截网址")["地址"] == "http://127.0.0.1:1/chat/completions")
        拿("/api/provider", {"名": "测 · 半截网址", "类型": "网页接口",
                             "地址": "http://127.0.0.1:1/chat/completions"})
        查("已经填全的再存一遍,一个字不变(幂等,屏上看见的 = 库里存下的)",
           next(x for x in 拿("/api/state")["供应商"]
                if x["名"] == "测 · 半截网址")["地址"] == "http://127.0.0.1:1/chat/completions")
        拿("/api/provider", {"名": "测 · 半截生图", "类型": "网页接口",
                             "地址": "http://127.0.0.1:1/v1/images/generations"})
        查("生图那条尾巴不许被换成 /chat/completions",
           next(x for x in 拿("/api/state")["供应商"]
                if x["名"] == "测 · 半截生图")["地址"].endswith("/v1/images/generations"))
        查("认得的那几种尾巴随 /api/state 下发(页面那行灰字吃它,不再自己抄一份)",
           拿("/api/state")["地址尾巴们"] == ai.地址尾巴们()
           and "/chat/completions" in 拿("/api/state")["地址尾巴们"])

        册 = 拿("/api/state")["名册"]
        查("出厂名册随 /api/state 下发,面板那张清单吃它", isinstance(册, list) and len(册) >= 6)
        查("名册里一个 key 都没有(它进 git、也随安装包发给用户)",
           not any(k in 条 for 条 in 册
                   for k in ("密钥", "key", "apikey", "api_key", "Authorization")))
        查("名册每家都带 名 / 类型 / 地址 三格(页面拿它画清单)",
           all(条.get("名") and 条.get("类型") and 条.get("地址") for 条 in 册))
        样 = next(条 for 条 in 册 if 条["名"] == "智谱开放平台 · 生图")
        照 = 拿("/api/provider", {"名": "智谱开放平台 · 生图", "照名册": True})
        查("照名册加一家:只报个名字就加得上", 照["成了"] and 照["新建"])
        新册家 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "智谱开放平台 · 生图")
        查("网址从名册抄进来了(用户一个字都不用打)", 新册家["地址"] == 样["地址"])
        查("模型清单也抄进来了", 新册家["模型们"] == 样["模型们"].split(","))
        查("「去这里领 key →」那行吃的注册页也抄进来了", 新册家["注册页"] == 样["注册页"])
        查("照名册加完还差一把 key,面板得照旧提示他填",
           新册家["要密钥"] and not 新册家["有密钥"])
        坏册 = 拿("/api/provider", {"名": "名册里没有这一家", "照名册": True})
        查("名册里没有的名字,当场给人话不给报错栈",
           not 坏册["成了"] and "厂商名册里没有" in 坏册["说"])

        拿("/api/provider", {"名": "测 · 生图家", "类型": "网页接口",
                             "地址": "http://127.0.0.1:1/v1/images/generations",
                             "模型们": "img-一,img-二"})
        拿("/api/key", {"供应商": "测 · 生图家", "密钥": "sk-shengtu"})
        拿("/api/consent", {"供应商": "测 · 生图家", "开": True})
        挂 = 拿("/api/feature", {"功能名": "测 · 出图", "种类": "生图", "供应商": "测 · 生图家"})
        查("挂一件新活上去", 挂["成了"] and 挂["新建"])
        新活 = next((x for x in 拿("/api/state")["功能"] if x["功能名"] == "测 · 出图"), None)
        查("刷新一次,新挂的那件活还在(判据)", 新活 is not None)
        查("种类存成生图了(前端靠它决定牌子写「要一张图」)", 新活 and 新活["种类"] == "生图")
        查("没填模型时自动取那一家清单里的第一个", 新活 and 新活["主用模型"] == "img-一")
        查("老功能默认算「文本」,不受影响",
           next(x for x in 拿("/api/state")["功能"]
                if x["功能名"] == "示例 · 生成")["种类"] == "文本")
        再挂 = 拿("/api/feature", {"功能名": "测 · 出图", "种类": "生图",
                                  "供应商": "测 · 生图家", "模型": "img-二"})
        查("同名再挂一次:说改的是原来那一行,不是新建", 再挂["成了"] and not 再挂["新建"])
        全5 = 拿("/api/state")
        查("同名不许多出一行", len([x for x in 全5["功能"] if x["功能名"] == "测 · 出图"]) == 1)
        查("改的是模型", next(x for x in 全5["功能"] if x["功能名"] == "测 · 出图")["主用模型"] == "img-二")
        查("功能名空着,当场给人话不给报错栈",
           not 拿("/api/feature", {"功能名": "", "种类": "生图", "供应商": "测 · 生图家"})["成了"])
        坏种 = 拿("/api/feature", {"功能名": "测 · 坏活", "种类": "外星种类", "供应商": "测 · 生图家"})
        查("种类瞎写,当场给人话不给报错栈", not 坏种["成了"] and "种类只能是" in 坏种["说"])
        坏家 = 拿("/api/feature", {"功能名": "测 · 坏活", "种类": "生图", "供应商": "根本没这家"})
        查("供应商瞎写,当场给人话不给报错栈", not 坏家["成了"] and "供应商表里没有" in 坏家["说"])
        查("参数不合格时不许留下半拉行",
           not any(x["功能名"] == "测 · 坏活" for x in 拿("/api/state")["功能"]))

        坏 = 拿("/api/try", {"功能名": "根本没这个功能"})
        查("试一下:功能瞎写,回的是人话不是报错栈",
           not 坏["成了"] and "功能表里没有" in 坏["说"])
        坏图 = 拿("/api/try", {"功能名": "测 · 出图"})
        查("试一下(生图):连不上也回人话,不给报错栈", not 坏图["成了"] and 坏图["说"])
        查("试一下:上游的错「说」里没有英文原文,原文另放一格",
           not re.search(r"[A-Za-z]{3,}", 坏图["说"]) and bool(坏图["原文"]))
        查("试一下(生图):没通就不许回图给浏览器", "图" not in 坏图)
        查("试一下(生图):没通就不许回格式给浏览器", "格式" not in 坏图)
        from unittest.mock import patch
        回执库 = str(临 / "receipt.db")
        for 名, 模型 in (("测 · 回执主", "receipt-primary"),
                         ("测 · 回执备", "receipt-backup")):
            ai.加供应商(名, "网页接口", "https://receipt.invalid/v1/images/generations",
                       模型, 库=回执库)
            ai.设密钥(名, "receipt-fake", 库=回执库)
            ai.设限速(名, 0, 0, 库=回执库)
        for 种 in ("文本", "生图"):
            功 = f"测 · 回执{种}"
            ai.加功能(功, 种, "测 · 回执主", "receipt-primary", 库=回执库)
            ai.加备选(功, "测 · 回执备", "receipt-backup", 库=回执库)
        假图 = (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR"
                + struct.pack(">II", 32, 24))
        def 回执假发(址, 钥, 载, *余):
            if 载["model"] == "receipt-primary":
                raise urllib.error.HTTPError(址, 503, "primary down", {}, io.BytesIO(b"primary down"))
            return "备选回答"
        with patch.object(ai, "_发网页请求", side_effect=回执假发):
            备答 = 试一下(回执库, "测 · 回执文本")
        执 = 备答.get("回执", {})
        查("试一下文本备选成功回执", 备答["成了"] and 执.get("换过备选") is True
           and 执.get("供应商") == "测 · 回执备" and 执.get("模型") == "receipt-backup"
           and bool(执.get("首选错误")))
        with patch.object(ai, "_发网页请求", return_value="首选回答"):
            主答 = 试一下(回执库, "测 · 回执文本")
        执 = 主答.get("回执", {})
        查("试一下文本首选成功回执", 主答["成了"] and 执.get("换过备选") is False
           and 执.get("供应商") == "测 · 回执主" and 执.get("模型") == "receipt-primary"
           and 执.get("首选错误") == "")
        def 回执假图(*参):
            回执假发(*参)
            return 假图, "image/png"
        with patch.object(ai, "_发生图请求", side_effect=回执假图):
            图答 = 试一下(回执库, "测 · 回执生图")
        执 = 图答.get("回执", {})
        查("试一下生图备选成功回执", 图答["成了"] and 执.get("换过备选") is True
           and 执.get("供应商") == "测 · 回执备" and 执.get("模型") == "receipt-backup"
           and bool(执.get("首选错误")))
        真头 = (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR"
                + struct.pack(">II", 1024, 768) + b"\x08\x06\x00\x00\x00")
        查("量得出 PNG 的宽高", _量尺寸(真头) == "1024×768,")
        真jpg = (b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9
                + b"\xff\xc0" + struct.pack(">H", 17) + b"\x08"
                + struct.pack(">HH", 768, 1408) + b"\x03" + b"\x00" * 6)
        查("量得出 JPEG 的宽高(宽高别写反)", _量尺寸(真jpg) == "1408×768,")
        查("不是图就不硬报尺寸", _量尺寸("这不是图".encode("utf-8")) == "")
        查("半截 PNG(只有 8 字节头)不许炸成 500,报空就行", _量尺寸(b"\x89PNG\r\n\x1a\n") == "")
        查("半截 JPEG 不许卡住,报空就行", _量尺寸(b"\xff\xd8" + b"\xff" * 200) == "")

        假 = ThreadingHTTPServer(("127.0.0.1", 0), _假供应商)
        threading.Thread(target=假.serve_forever, daemon=True).start()
        假址 = f"http://127.0.0.1:{假.server_address[1]}/v1/chat/completions"
        拿("/api/provider", {"名": "测 · 会列模型的家", "类型": "网页接口",
                             "地址": 假址, "模型们": "老清单里的一个"})
        拿("/api/key", {"供应商": "测 · 会列模型的家", "密钥": "sk-liemoxing"})
        列 = 拿("/api/models", {"供应商": "测 · 会列模型的家"})
        查("问它要模型列表:拿回来了", 列["成了"] and 列["清单"] == ["假模型甲", "假模型乙"])
        查("问模型问的是换算出来的那条地址,不是聊天那条",
           列.get("地址", "").endswith("/v1/models"))
        那家 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 会列模型的家")
        查("刷新一次,新清单真存进「模型们」了(下拉框吃的就是它)",
           那家["模型们"] == ["假模型甲", "假模型乙"])
        查("覆盖不是合并:对家不认的老模型不许留在清单里",
           "老清单里的一个" not in 那家["模型们"] and 列["不认了"] == ["老清单里的一个"])
        灰 = 拿("/api/models", {"供应商": ai._测CL})
        查("命令行那家:回人话不回报错栈(页面上那颗钮也是灰的)",
           not 灰["成了"] and "没有「列模型」这个接口" in 灰["说"])
        没这家 = 拿("/api/models", {"供应商": "根本没这家"})
        查("问模型:供应商瞎写,当场给人话", not 没这家["成了"] and "供应商表里没有" in 没这家["说"])

        拿("/api/feature", {"功能名": "测 · 一条口", "种类": "文本",
                           "供应商": "测 · 会列模型的家"})
        拿("/api/feature", {"功能名": "测 · 一条口 · 我自己起的名", "种类": "文本",
                           "供应商": "测 · 会列模型的家"})
        删手工 = 拿("/api/delfeature", {"功能名": "测 · 一条口 · 我自己起的名"})
        查("手工起名的那一行,面板上删得掉了", 删手工["成了"])
        删口 = 拿("/api/delfeature", {"功能名": "测 · 一条口"})
        查("这条口自己那一行,面板上也删得掉了", 删口["成了"])
        还剩 = {x["功能名"] for x in 拿("/api/state")["功能"]}
        查("删完刷新,这两行真查不到了",
           "测 · 一条口 · 我自己起的名" not in 还剩 and "测 · 一条口" not in 还剩)
        查("删一行不许把别的行带走", "示例 · 生成" in 还剩 and "示例 · 润色" in 还剩)
        没这行 = 拿("/api/delfeature", {"功能名": "根本没这一行"})
        查("删一个本来就没有的名字:回人话不报错栈,也不算删成功",
           not 没这行["成了"] and "本来就没有" in 没这行["说"])
        空名 = 拿("/api/delfeature", {"功能名": ""})
        查("删的名字空着,当场给人话", not 空名["成了"] and "删哪一行" in 空名["说"])

        拿("/api/provider", {"名": "测 · 删得掉的家", "类型": "网页接口",
                            "地址": "http://127.0.0.1:1/v1/chat/completions", "模型们": "m甲"})
        删空家 = 拿("/api/delprovider", {"供应商": "测 · 删得掉的家"})
        查("没人用的那一家,面板上删得掉了", 删空家["成了"])
        查("删完刷新,那一家真查不到了",
           not any(x["名"] == "测 · 删得掉的家" for x in 拿("/api/state")["供应商"]))
        拿("/api/feature", {"功能名": "测 · 占着一家不放", "种类": "文本", "供应商": "DeepSeek"})
        用着的 = 拿("/api/delprovider", {"供应商": "DeepSeek"})
        查("还有功能拨给它的时候不给删,而且说清是哪几条",
           not 用着的["成了"] and "条功能" in 用着的["说"]
           and "测 · 占着一家不放" in 用着的["说"] and "改选别家" in 用着的["说"])
        查("拒绝之后那一家原样还在",
           any(x["名"] == "DeepSeek" for x in 拿("/api/state")["供应商"]))
        没这家2 = 拿("/api/delprovider", {"供应商": "根本没这一家"})
        查("删一个本来就没有的家:回人话不报错栈,也不算删成功",
           not 没这家2["成了"] and "本来就没有" in 没这家2["说"])
        空家名 = 拿("/api/delprovider", {"供应商": ""})
        查("删的家名空着,当场给人话", not 空家名["成了"] and "删哪一家" in 空家名["说"])

        查("功能行默认是开着的",
           all(x["启用"] for x in 拿("/api/state")["功能"]))
        关 = 拿("/api/enable", {"功能名": "示例 · 润色", "开": False})
        查("关一行:回一句人话说清后果", 关["成了"] and "下拉框里没有它" in 关["说"])
        态 = {x["功能名"]: x for x in 拿("/api/state")["功能"]}
        查("关完刷新,这一行还在、只是标着关",
           "示例 · 润色" in 态 and 态["示例 · 润色"]["启用"] is False)
        查("关一行不许把别的行也关了", 态["示例 · 生成"]["启用"] is True)
        开回 = 拿("/api/enable", {"功能名": "示例 · 润色", "开": True})
        查("再点一下就开回来了(跟删不一样,收得回)",
           开回["成了"] and {x["功能名"]: x for x in 拿("/api/state")["功能"]}["示例 · 润色"]["启用"])
        没那行 = 拿("/api/enable", {"功能名": "根本没这一行", "开": False})
        查("关一个本来就没有的名字:回人话不报错栈", not 没那行["成了"] and "没找到" in 没那行["说"])

        查("功能行出厂落「关」(= 补这列之前底座一直以来的行为)",
           all(x["用力"] == "关" for x in 拿("/api/state")["功能"]))
        换劲 = 拿("/api/effort", {"功能名": "示例 · 润色", "用力": "high"})
        查("面板上换一档存得进", 换劲["成了"])
        态2 = {x["功能名"]: x for x in 拿("/api/state")["功能"]}
        查("换完刷新还在", 态2["示例 · 润色"]["用力"] == "high")
        查("换一行的档不许把别的行也换了", 态2["示例 · 生成"]["用力"] == "关")
        乱填 = 拿("/api/effort", {"功能名": "示例 · 润色", "用力": "随便想想"})
        查("填个中文档名:当场给人话不给报错栈", not 乱填["成了"] and "原厂" in 乱填["说"])
        查("乱填之后库里那一格没被动",
           {x["功能名"]: x for x in 拿("/api/state")["功能"]}["示例 · 润色"]["用力"] == "high")
        拿("/api/effort", {"功能名": "示例 · 润色", "用力": "关"})
        家们 = {x["名"]: x for x in 拿("/api/state")["供应商"]}
        查("state 里带着每家的强度清单",
           all(isinstance(x.get("强度档"), list) and x["强度档"] for x in 家们.values()))
        全态 = 拿("/api/state")
        查("state 里带着「上次想了多少」那张账", isinstance(全态.get("想过"), dict))
        查("日志每条都带「想了」那一格",
           all("想了" in g for g in 全态["日志"]) if 全态["日志"] else True)
        记 = ai.连库(门.库)
        ai._记日志(记, "自检 · 想了", "测 · 家", "测 · 模", True, time.time(), "", 55, "high")
        记.close()
        账 = 拿("/api/state")["想过"]
        查("页面那个拼法查得到刚记的那一条(键两边得对上)",
           (账.get("测 · 家\n测 · 模\nhigh") or {}).get("想了") == 55)

        加1 = 拿("/api/addpreset", {"功能名": "示例 · 生成", "供应商": "测 · 外网家",
                                   "模型": "m一", "显示名": "便宜快"})
        查("加一个备选模型", 加1["成了"] and 加1["全名"] == "示例 · 生成 · 便宜快")
        查("加完刷新看得见",
           "示例 · 生成 · 便宜快" in {x["功能名"] for x in 拿("/api/state")["功能"]})
        加2 = 拿("/api/addpreset", {"功能名": "示例 · 生成", "供应商": "测 · 外网家", "模型": "m二"})
        查("没起名字就用「家/模型」当名字", 加2["成了"] and 加2["全名"].endswith("测 · 外网家/m二"))
        满 = 拿("/api/addpreset", {"功能名": "示例 · 生成", "供应商": "测 · 外网家", "模型": "m一",
                                  "显示名": "第四个"})
        查("满 3 个之后加不进去,给的是人话", not 满["成了"] and "最多摆 3 个" in 满["说"])
        查("拦下来不许留下半拉行",
           "示例 · 生成 · 第四个" not in {x["功能名"] for x in 拿("/api/state")["功能"]})
        拿("/api/delfeature", {"功能名": "示例 · 生成 · 便宜快"})
        拿("/api/delfeature", {"功能名": 加2["全名"]})
        查("删完名额就腾出来了",
           拿("/api/addpreset", {"功能名": "示例 · 生成", "供应商": "测 · 外网家",
                                "模型": "m一", "显示名": "腾出来了"})["成了"])
        拿("/api/delfeature", {"功能名": "示例 · 生成 · 腾出来了"})

        拿("/api/provider", {"名": "测 · 外网家", "类型": "网页接口",
                             "地址": "https://api.example.com/v1/chat/completions",
                             "模型们": "m一,m二"})
        摁 = 拿("/api/hide", {"供应商": "测 · 外网家", "模型": "m二", "为什么": "我自己不想在这儿用"})
        查("手动摁一个模型下去", 摁["成了"] and 摁["新记"])
        def 笔记(名="测 · 外网家"):
            家 = [x for x in 拿("/api/state")["供应商"] if x["名"] == 名][0]
            return {x["模型"]: x for x in 家["模型笔记"]}
        def 藏了什么():
            return {m: x["备注"] for m, x in 笔记().items() if x["藏了"]}
        查("摁完 /api/state 里看得见,理由是人写的那句",
           藏了什么().get("m二") == "我自己不想在这儿用")
        改 = 拿("/api/hide", {"供应商": "测 · 外网家", "模型": "m二", "为什么": "改过的理由"})
        查("再摁一次 = 改理由,不是报错", 改["成了"] and not 改["新记"])
        查("理由真改了", 藏了什么().get("m二") == "改过的理由")
        查("隐藏不许动模型清单本身 —— 它只管露不露面,不挡任何调用",
           "m二" in [x for x in 拿("/api/state")["供应商"] if x["名"] == "测 · 外网家"][0]["模型们"])
        放 = 拿("/api/unhide", {"供应商": "测 · 外网家", "模型": "m二"})
        查("取消隐藏(这条口 2026-09-03 之前不在白名单上,点了是 404)", 放["成了"])
        查("放完就不在藏起来的名单里了", "m二" not in 藏了什么())
        查("取消隐藏不许把那一行删掉 —— 当初为什么、判断、上次测出什么都得留着",
           笔记().get("m二", {}).get("备注") == "改过的理由")
        查("放一个本来就没藏的,给的是人话不是崩",
           not 拿("/api/unhide", {"供应商": "测 · 外网家", "模型": "m二"})["成了"])
        查("写备注", 拿("/api/modelnote", {"供应商": "测 · 外网家", "模型": "m一",
                                          "备注": "这个贵"})["成了"])
        查("写判断", 拿("/api/modelnote", {"供应商": "测 · 外网家", "模型": "m一",
                                          "判断": "长文能扛"})["成了"])
        查("两格在 /api/state 里各存各的,不互相盖",
           笔记().get("m一", {}).get("备注") == "这个贵"
           and 笔记().get("m一", {}).get("判断") == "长文能扛")
        拿("/api/consent", {"供应商": "测 · 会列模型的家", "开": True})
        通 = 拿("/api/probe", {"供应商": "测 · 会列模型的家", "模型": "假模型甲"})
        查("点「测试」:真发一次,通了", 通["成了"] and "假的一句回答" in 通["说"])
        查("测完那一行记着通没通、什么时候测的",
           笔记("测 · 会列模型的家").get("假模型甲", {}).get("连通") == "通"
           and 笔记("测 · 会列模型的家").get("假模型甲", {}).get("测于"))
        空口 = socket.socket()
        空口.bind(("127.0.0.1", 0))
        没人听 = 空口.getsockname()[1]
        空口.close()
        拿("/api/provider", {"名": "测 · 打不通的家", "类型": "网页接口",
                             "地址": f"http://127.0.0.1:{没人听}/v1/chat/completions",
                             "模型们": "m一"})
        拿("/api/key", {"供应商": "测 · 打不通的家", "密钥": "sk-dabutong"})
        拿("/api/consent", {"供应商": "测 · 打不通的家", "开": True})
        拿("/api/modelnote", {"供应商": "测 · 打不通的家", "模型": "m一", "备注": "人写的那句"})
        死 = 拿("/api/probe", {"供应商": "测 · 打不通的家", "模型": "m一"})
        查("打不通:回一句人话不是崩,报错原文进那一行",
           not 死["成了"] and 笔记("测 · 打不通的家").get("m一", {}).get("连通") == "不通"
           and 笔记("测 · 打不通的家").get("m一", {}).get("测出的话"))
        查("测试不许动人写的那两格",
           笔记("测 · 打不通的家").get("m一", {}).get("备注") == "人写的那句")

        查("看得见图的那个:测试递图答对颜色,记成「能 · 测试」,回执里说了",
           通.get("看图") == "能" and 通.get("看图来源") == "测试" and "能看图" in 通["说"])
        查("测通了就记下用时,回执里带着秒数",
           isinstance(笔记("测 · 会列模型的家").get("假模型甲", {}).get("测速毫秒"), int)
           and "用时" in 通["说"])
        乙测 = 拿("/api/probe", {"供应商": "测 · 会列模型的家", "模型": "假模型乙"})
        查("不收图的那个:递图被 400 拒 → 再补一问纯文字,照样算通,看图记「不能」",
           乙测["成了"] and 乙测.get("看图") == "不能" and 乙测.get("看图来源") == "测试"
           and "不能看图" in 乙测["说"])
        查("打不通的那家:看图那一格不许被一次连不上染成「不能」,用时也不留",
           笔记("测 · 打不通的家").get("m一", {}).get("看图") == ""
           and 笔记("测 · 打不通的家").get("m一", {}).get("测速毫秒") is None)
        拿("/api/models", {"供应商": "测 · 会列模型的家"})
        查("再拉一次清单:清单自报的不许盖掉「测试」真测出来的",
           笔记("测 · 会列模型的家").get("假模型甲", {}).get("看图来源") == "测试")
        状 = 拿("/api/state")
        查("档序跟着 /api/state 出去了(推理强度下拉框摆全档、灰掉不认的那几档吃它)",
           状.get("档序") == ["none", "minimal", "low", "medium", "high", "xhigh", "max"])
        查("命令行那家也标着「递得进图」(走 stream-json),网页那家照旧",
           {x["名"]: x for x in 状["供应商"]}[ai._测CL].get("递得进图") is True
           and {x["名"]: x for x in 状["供应商"]}["测 · 会列模型的家"].get("递得进图") is True)

        探甲 = 拿("/api/effortprobe", {"供应商": "测 · 会列模型的家", "模型": "假模型甲"})
        查("点「探档位」:接口自己把合法档列出来了",
           探甲["成了"] and 探甲["来源"] == "接口自报"
           and 探甲["档们"] == ["low", "medium", "high"])
        查("探完档位不许动「连通」那一格 —— 故意要来的 400 不是「打不通」",
           笔记("测 · 会列模型的家").get("假模型甲", {}).get("连通") == "通")
        探乙 = 拿("/api/effortprobe", {"供应商": "测 · 会列模型的家", "模型": "假模型乙"})
        查("写错的值它照收 = 这个模型没有推理强度这一格",
           探乙["来源"] == "不吃这一格" and 探乙["档们"] == [])
        家档 = {x["名"]: x for x in 拿("/api/state")["供应商"]}["测 · 会列模型的家"]["模型档位"]
        查("每个模型那一份档位跟着 /api/state 出去了(页面的下拉框吃它)",
           家档.get("假模型甲", {}).get("档们") == ["low", "medium", "high"]
           and 家档["假模型甲"]["来源"] == "接口自报"
           and 家档.get("假模型乙", {}).get("档们") == []
           and 家档["假模型乙"]["来源"] == "不吃这一格")
        查("没探过的模型照实说「没探过」,不拿候选值冒充探过",
           ({x["名"]: x for x in 拿("/api/state")["供应商"]}["测 · 外网家"]["模型档位"]
            .get("m一", {}).get("来源") == "没探过")
           and ({x["名"]: x for x in 拿("/api/state")["供应商"]}["测 · 外网家"]["模型档位"]
                .get("m一", {}).get("档们")))
        查("「关闭」在这个模型上发什么,跟着那一格一起出去(页面不自己判)",
           家档["假模型甲"].get("关法") == "最低档 low"
           and 家档["假模型乙"].get("关法") == "没这一格")
        探死 = 拿("/api/effortprobe", {"供应商": "测 · 打不通的家", "模型": "m一"})
        查("连不上的家:探不成给一句人话,不是崩", not 探死.get("成了"))
        查("给功能写一句说明", 拿("/api/note", {"功能名": "示例 · 生成",
                                              "说明": "测试写进去的一句说明"})["成了"])
        查("说明在 /api/state 里带回来",
           [x["说明"] for x in 拿("/api/state")["功能"]
            if x["功能名"] == "示例 · 生成"] == ["测试写进去的一句说明"])
        查("给不存在的行写说明:回一句人话,不是崩",
           not 拿("/api/note", {"功能名": "没有这一行", "说明": "x"})["成了"])

        查("区头写备注", 拿("/api/projectnote", {"项目名": "示例", "备注": "自动示例"})["成了"])
        查("区头写网址", 拿("/api/projectnote",
                         {"项目名": "示例", "网址": "http://127.0.0.1:8000/"})["成了"])
        查("两格互不覆盖 —— 写完网址那句备注还在",
           拿("/api/state")["项目"].get("示例", {}) ==
           {"备注": "自动示例", "网址": "http://127.0.0.1:8000/"})
        坏址 = 拿("/api/projectnote", {"项目名": "示例", "网址": "javascript:alert(1)"})
        查("javascript: 那种网址拦得住(这一格会变成页面上一个真能点的链接)",
           not 坏址.get("成了") and "http" in str(坏址))
        拿("/api/addpreset", {"功能名": "示例 · 生成", "供应商": "DeepSeek", "模型": "备选那个"})
        提 = 拿("/api/promote", {"这一档": "示例 · 生成 · DeepSeek/备选那个",
                               "顶上那行": "示例 · 生成"})
        功能表 = {x["功能名"]: x for x in 拿("/api/state")["功能"]}
        备名 = 提.get("甲新名", "")
        查("「设为首选」把备选那个模型提到了顶上那一行",
           提["成了"] and 功能表["示例 · 生成"]["主用模型"] == "备选那个")
        查("对调不是复制 —— 原来那个模型落到备选那一行去了",
           备名 in 功能表 and 功能表[备名]["主用模型"] != "备选那个")
        查("回执报的那一家跟下拉框里真显示的是同一个(报错了半边人会以为没提上去)",
           "备选那个" in 提["说"])
        查("头行名一个字都没动(接入方报的就是它)", "示例 · 生成" in 功能表)
        查("自动起名的备选行名字跟着换过来的设定改(2026-09-27),旧名不留",
           备名 in 功能表 and 备名 == "示例 · 生成 · {主用供应商}/{主用模型}".format(**功能表[备名])
           and "示例 · 生成 · DeepSeek/备选那个" not in 功能表)
        跨 = 拿("/api/promote", {"这一档": "示例 · 生成", "顶上那行": "示例 · 润色"})
        查("跨着两条口对调,拦得住", not 跨.get("成了"))
        前 = {x["功能名"]: x["主用模型"] for x in 拿("/api/state")["功能"]}
        挪 = 拿("/api/move", {"功能名": 备名, "方向": "上"})
        后 = {x["功能名"]: x["主用模型"] for x in 拿("/api/state")["功能"]}
        查("↑ 把备选的模型换到首选那一行、首选的换下来;回包「这一行」是改名后的名字",
           挪.get("成了") and 后["示例 · 生成"] == 前[备名]
           and 后.get(挪.get("这一行")) == 前["示例 · 生成"] and 挪.get("换到") == "示例 · 生成")
        查("↑ 的回执报的是这一行挪完拨给谁", 后.get(挪.get("这一行"), "?") in 挪.get("说", ""))
        路 = 拿("/api/route", {"功能名": 挪.get("这一行"), "供应商": "DeepSeek", "模型": "改个名"})
        查("备选行换模型:回包带新名,拿新名接着存推理强度存得上(页面粘贴就是这么走的)",
           路.get("全名") == "示例 · 生成 · DeepSeek/改个名"
           and 拿("/api/effort", {"功能名": 路.get("全名"), "用力": "high"}).get("成了"))
        顶头 = 拿("/api/move", {"功能名": "示例 · 生成", "方向": "上"})
        查("首选再往上挪拦得住,并说清已经在最上面", not 顶头.get("成了") and "最上面" in str(顶头))

        假.shutdown()
        假.server_close()

        查("没带口令打进来会被挡", 挡住了吗(底))

        坏来处 = "https://evil.example.com"
        try:
            查("🔴 本机、没带口令、地址栏直接打开(没有 Origin):照样挡 —— 撤掉的兜底不许回来",
               挡住了吗(底, "/api/state", 头={}))
            查("🔴 本机、没带口令、Origin 就是面板自己:照样挡 —— 页面那几个 fetch 靠 cookie 进",
               挡住了吗(底, "/api/state", 头={"Origin": 底}))
            查("🔴 Host 写成 localhost、没口令,照样挡 —— 兜底那条后门不许还在",
               挡住了吗(底, "/api/state", 头={"Host": "localhost"}))
            查("🔴 别的网页背着人打进来(Origin 是它自己):当场挡掉 —— 跨站伪造请求那个洞",
               挡住了吗(底, "/api/state", 头={"Origin": 坏来处}))
            查("🔴 它拿 POST 来改密钥也一样挡(那个洞真正值钱的一半)",
               挡住了吗(底, "/api/key", 头={"Origin": 坏来处, "Content-Type": "application/json"},
                        数据=json.dumps({"供应商": "DeepSeek", "密钥": "x"}).encode("utf-8")))
            查("带对口令的照旧进得来(面板自己开的那条网址、壳从 面板地址.txt 读的也是它)",
               not 挡住了吗(底, "/api/state?k=zz9test9", 头={"Origin": 坏来处}))
            查("口令错一个字进不来", 挡住了吗(底, "/api/state?k=zz9test8"))
            查("带对口令就进得来(Host 是外面的名字也认)",
               not 挡住了吗(底, "/api/state?k=zz9test9"))
            with urllib.request.urlopen(底 + "/?k=zz9test9", timeout=10) as r:
                饼 = r.headers.get("Set-Cookie") or ""
            查("头一次带口令开页,浏览器被塞了 cookie(往后不用再打口令)",
               饼.startswith(f"{饼名}=zz9test9;"))
            凭饼 = urllib.request.Request(底 + "/api/state", headers={"Cookie": f"{饼名}=zz9test9"})
            with urllib.request.urlopen(凭饼, timeout=10) as r:
                查("光凭 cookie、地址上不带口令也进得来", r.status == 200)
            查("🔴 浏览器里同时躺着别的面板塞的 k=<它的口令>(cookie 不分端口):照样进得来",
               not 挡住了吗(底, "/api/state", 头={"Cookie": f"k=kbother1; {饼名}=zz9test9"}))
            查("改名前记下的老 cookie k=<本面板口令> 还认(过渡)",
               not 挡住了吗(底, "/api/state", 头={"Cookie": "k=zz9test9"}))
            门.口令 = None
            查("🔴 口令根本没设的时候:谁都进不来(不许有『没口令就放行』这条路)",
               挡住了吗(底, "/api/state", 头={}))
        finally:
            门.口令 = 自检口令

        try:
            甲, 乙 = 开门(门.库), 开门(门.库)
            查("🔴 本机模式也掷口令(不再只有 --局域网 才有),而且每次起服务换一个",
               bool(甲) and bool(乙) and len(甲) == 8 and len(乙) == 8 and 甲 != 乙)
            丙 = 开门(门.库, 局域网=True)
            查("局域网那份存在文件里、重启不变(手机上那串字只用打第一次)",
               丙 == 开门(门.库, 局域网=True))
        finally:
            门.口令 = 自检口令
        查("没这个地址的回 404", 挡住了吗(底, "/api/nope", 404, 头={"Cookie": f"k={门.口令}"}))

        try:
            with urllib.request.urlopen(底 + quote("/共用.css") + f"?k={门.口令}", timeout=10) as r:
                样式 = r.read().decode("utf-8")
        except Exception as e:
            样式 = f"(拿不到:{e.__class__.__name__}: {e})"
        查(f"共用.css 发得出来、里头有颜色变量(拿到 {len(样式)} 字)", "--蓝:" in 样式)
        for 名, 认 in (("页眉侧栏.js", "UI布局"), ("菜单.js", "UI布局.装")):
            try:
                with urllib.request.urlopen(底 + quote("/" + 名) + f"?k={门.口令}", timeout=10) as r:
                    脚, 型 = r.read().decode("utf-8"), r.headers.get("Content-Type", "")
            except Exception as e:
                脚, 型 = f"(拿不到:{e.__class__.__name__}: {e})", ""
            查(f"{名} 发得出来、按 text/javascript 发(拿到 {len(脚)} 字,{型})",
               认 in 脚 and 型.startswith("text/javascript"))

        f = 面板目录 / "index.html"
        查("面板文件在", f.exists())
        if f.exists():
            页 = f.read_text(encoding="utf-8")
            查("页面里没有写死的磁盘路径", "/" "home/" not in 页 and "C:\\" not in 页)
            共用行 = '<link rel="stylesheet" href="共用.css">'
            查("页面引了同目录的 共用.css(共用样式;丢了这行整页没颜色)", 共用行 in 页)
            顶栏行 = ('<script src="页眉侧栏.js"></script>', '<script src="菜单.js"></script>')
            查("页面引了共用顶栏(页眉侧栏.js + 菜单.js)", all(x in 页 for x in 顶栏行))
            扫 = 页.replace(共用行, "")
            for x in 顶栏行:
                扫 = 扫.replace(x, "")
            for 名 in 静态.values():
                扫 = 扫.replace(f'<script src="{名}"></script>', "").replace(
                    f'<link rel="stylesheet" href="{名}">', "")
            外部 = [x for x in ("<script src", "<link ", "@import", "url(http", "//cdn",
                                'fetch("http', "fetch('http", 'src="http', "src='http",
                                'href="http', "href='http") if x in 扫]
            查("页面没引任何外部东西(铁律一:零第三方依赖)" + ("" if not 外部 else " ← 命中:" + "、".join(外部)),
               not 外部)

        收请求那道门(查, 拿, 裸拿)
        插件契约(查)
        接入方找得到(查)
        撞口也起得来(查, 临)
        指错家也画得出(查, 底)
        分组只认父功能那一格(查, 底)
        收起行格子不错位(查, 底)

        服务.shutdown()
        服务.server_close()
    finally:
        shutil.rmtree(临, ignore_errors=True)

    坏 = [n for n, ok in 过 if not ok]
    print(f"\n{len(过) - len(坏)}/{len(过)} 项过了" + ("" if not 坏 else "\n没过的:" + "、".join(坏)))
    return 0 if not 坏 else 1


def 收请求那道门(查, 拿, 裸拿):
    码, 体 = 裸拿("/api/enable", 头={"Content-Length": "-5"})
    查("Content-Length 是负数:当场 400,不让这个线程等一个不会来的正文", 码 == 400 and "读不出来" in 体["错"])
    码, 体 = 裸拿("/api/enable", 头={"Content-Length": "abc"})
    查("Content-Length 不是数字:400 人话,不是报错栈", 码 == 400 and "读不出来" in 体["错"])
    码, 体 = 裸拿("/api/enable", b"[1, 2]")
    查("正文顶层不是对象:400", 码 == 400 and "读不出来" in 体["错"])
    码, 体 = 裸拿("/api/enable", json.dumps({"功能名": "示例 · 生成", "开": "false"}).encode())
    查("开关给的是字符串 \"false\":400 不收(以前 bool() 把它当真)", 码 == 400 and "参数不对" in 体["错"])
    查("那一行没被这次坏请求关掉",
       next(x for x in 拿("/api/state")["功能"] if x["功能名"] == "示例 · 生成")["启用"] is True)
    前 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")
    码, 体 = 裸拿("/api/throttle", json.dumps({"供应商": "DeepSeek", "最小间隔秒": -1, "每小时上限": 0}).encode())
    查("节流给负数:400", 码 == 400 and "参数不对" in 体["错"])
    码, 体 = 裸拿("/api/throttle", json.dumps({"供应商": "DeepSeek", "最小间隔秒": "abc", "每小时上限": 0}).encode())
    查("节流给非数字:400", 码 == 400 and "参数不对" in 体["错"])
    后 = next(x for x in 拿("/api/state")["供应商"] if x["名"] == "DeepSeek")
    查("坏节流值一个都没存进去",
       (后["最小间隔秒"], 后["每小时上限"]) == (前["最小间隔秒"], 前["每小时上限"]))
    原 = ai.读配置

    def 炸(*a, **k):
        raise RuntimeError("/秘密的/路径/配置.db sk-" "fake-secret-for-test 打不开")

    ai.读配置 = 炸
    try:
        码, 体 = 裸拿("/api/state", 方法="GET")
    finally:
        ai.读配置 = 原
    查("没预料到的异常:500 + 中文下一步与可复制取证,路径和密钥不出门",
       码 == 500 and 体["错"] == "面板读不了设置，重试或复制报错"
       and len(体["错"]) <= 25 and 体["报错类名"] == "RuntimeError"
       and 体["接口"] == "/api/state" and bool(体["时间"]) and 体["错误号"].startswith("PANEL-")
       and "秘密" not in json.dumps(体) and "sk-" "fake-secret-for-test" not in json.dumps(体))


def 指错家也画得出(查, 底):
    def 指错家(态):
        态["功能"][0]["主用供应商"] = "已经删掉的一家"

    dom = _抓真DOM(底, 指错家, "功能行指着库里没有的家,页面照样画得出")
    if dom is None:
        return
    查("功能行指着库里没有的家,「功能」模块照样画得出、「＋ 添加功能」还在(不是一块空白)",
       '<div id="功能"></div>' not in dom and "添加功能" in dom)
    查("那一行上明说「库里没有这一家了」,人知道该去改哪儿",
       "库里没有「已经删掉的一家」这一家了" in dom)


def _抓真DOM(底, 改一改, 验的是什么):
    import shutil
    import subprocess
    浏览器 = next((shutil.which(x) for x in ("chromium", "chromium-browser", "google-chrome")
                  if shutil.which(x)), None)
    if not 浏览器:
        print(f"  – 跳过:本机没有 chromium,「{验的是什么}」那几条没验")
        return None
    原 = ai.读配置

    def 改过的读配置(*a, **k):
        态 = 原(*a, **k)
        改一改(态)
        return 态

    ai.读配置 = 改过的读配置
    try:
        r = subprocess.run([浏览器, "--headless", "--disable-gpu", "--no-sandbox",
                            "--virtual-time-budget=15000", "--dump-dom",
                            底 + f"/?k={门.口令}"],
                           capture_output=True, timeout=90)
        return r.stdout.decode("utf-8", "replace")
    finally:
        ai.读配置 = 原


def 分组只认父功能那一格(查, 底):
    def 铺两档(态):
        样 = dict(态["功能"][0])
        态["功能"] = [{**样, "功能名": "测组 · 没头行 · 甲", "父功能": "测组 · 没头行"},
                    {**样, "功能名": "测组 · 没头行 · 测 · 家/m一", "父功能": "测组 · 没头行"}]

    dom = _抓真DOM(底, 铺两档, "头行不在库里的两档还分在同一条口下")
    if dom is None:
        return
    查("一条口的头行不在库里、家名里又带「 · 」,两档照样画在同一条口下(2/3,不是两个 1/3)",
       "备选模型 2/3" in dom and "备选模型 1/3" not in dom)
    查("卡头印的口名是库里那一格写的,不是砍名字砍出来的「测组 · 没头行 · 测」",
       ">没头行 · 测" not in dom)


def 收起行格子不错位(查, 底):
    import re

    def 铺一族(态):
        样 = dict(态["功能"][0])
        态["功能"] = [{**样, "功能名": "测组 · 头", "父功能": ""},
                    {**样, "功能名": "测组 · 头 · 备一", "父功能": "测组 · 头"}]

    dom = _抓真DOM(底, 铺一族, "收起的功能行格子不错位")
    if dom is None:
        return
    查("带备选的功能行收起时,「备选数」后面紧跟的是「启用」那一格(没往左错一格)",
       re.search(r'class="数值">\d+</td><td><label class="对"', dom) is not None
       and re.search(r'class="数值">\d+<label', dom) is None)
    查("收起的功能行最右那格里 测试 / 复制 / 粘贴 三颗挨着(不用点开才找得到)",
       re.search(r'<span class="操作"><button[^>]*>测试</button><button[^>]*>复制</button>'
                 r'<button[^>]*>粘贴</button></span>', dom) is not None)


def 撞口也起得来(查, 临):
    import os
    import socket
    import subprocess
    import urllib.request

    占 = socket.socket()
    占.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    占.bind(("127.0.0.1", 0))
    占.listen(1)
    被占 = 占.getsockname()[1]
    子 = None
    try:
        子 = subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), str(临 / "撞口"),
             "--端口", str(被占), "--不开"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONUNBUFFERED": "1"})
        盒 = []
        读 = threading.Thread(target=lambda: 盒.append(子.stdout.readline()), daemon=True)
        读.start()
        读.join(30)
        头行 = (盒[0] if 盒 else b"").decode("utf-8", "replace").strip()
        查(f"出厂口被占,第一行仍打得出 AI_BASE_PORT=<真口>(实得:{头行 or '(没输出)'})",
           头行.startswith("AI_BASE_PORT="))
        真口 = int(头行.split("=", 1)[1]) if 头行.startswith("AI_BASE_PORT=") else 被占
        查("换到的是另一个口,不是被占那个", 真口 != 被占)
        地址 = ""
        try:
            地址 = (临 / "撞口" / "面板地址.txt").read_text(encoding="utf-8").strip()
        except OSError:
            pass
        查(f"面板地址.txt 里写的是真用上的那个号 + 一串口令(实得:{地址 or '(没这个文件)'})",
           地址.startswith(f"http://127.0.0.1:{真口}/?k=") and len(地址.split("?k=")[-1]) == 8)
        通 = False
        截止 = time.time() + 15
        while 地址 and time.time() < 截止 and 子.poll() is None:
            try:
                with urllib.request.urlopen(地址, timeout=3) as r:
                    通 = r.status == 200
                break
            except Exception:
                time.sleep(0.3)
        查("照 面板地址.txt 那条网址打过去,换口之后那个号上真的能打开面板(壳走的就是这条)", 通)
    finally:
        if 子 and 子.poll() is None:
            子.terminate()
            try:
                子.wait(timeout=5)
            except subprocess.TimeoutExpired:
                子.kill()
        占.close()

    占 = socket.socket()
    占.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    占.bind(("0.0.0.0", 0))
    占.listen(1)
    被占 = 占.getsockname()[1]
    try:
        子 = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), str(临 / "撞口局域网"),
             "--端口", str(被占), "--不开", "--局域网"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30,
            env={**os.environ, "PYTHONUNBUFFERED": "1"})
        出 = 子.stdout.decode("utf-8", "replace")
        查("🔴 开了局域网、出厂口被占:直接退出(非零),不挪到别的号上", 子.returncode != 0)
        查("退出前一句人话说清是哪个号被占、为什么不挪", "占着" in 出 and "不挪号" in 出)
        查("没打 AI_BASE_PORT= 那一行 —— 没起来就不许报号", "AI_BASE_PORT=" not in 出)
        查("🔴 没起来也不许写 面板地址.txt —— 写了就是把一个打不开的号交给壳,它分辨不出来",
           not (临 / "撞口局域网" / "面板地址.txt").exists())
    except subprocess.TimeoutExpired:
        查("开了局域网、出厂口被占:30 秒内该退出,却一直挂着(=挪了号在跑)", False)
    finally:
        占.close()


def 插件契约(查):
    import os
    import shutil
    import socket
    import subprocess
    import tempfile
    import urllib.error
    import urllib.request

    本仓 = Path(__file__).resolve().parent
    声明 = json.loads((本仓 / "插件.json").read_text(encoding="utf-8"))

    原文 = (本仓 / "插件.json").read_text(encoding="utf-8")
    查("插件声明里没有写死的磁盘路径(铁律二)", "/" "home/" not in 原文 and "C:\\" not in 原文)
    查("插件声明说自己不要装任何第三方库(铁律一)", 声明.get("要装的库") == [])

    用户根 = Path(tempfile.mkdtemp(prefix="aibase-plugin-"))
    口 = socket.socket()
    口.bind(("127.0.0.1", 0))
    端口 = 口.getsockname()[1]
    口.close()

    def 换(s):
        return s.replace("<用户根>", str(用户根)).replace("<端口>", str(端口))

    参数 = [换(x) for x in 声明["起"]["参数"]]
    对外提供 = {k: 换(v) for k, v in (声明.get("对外提供") or {}).items()}

    def 目录层们(p):
        return [x for x in Path(p).parts[:-1] if x not in ("/", "\\")]

    带中文的层 = [x for p in list(参数) + list(对外提供.values()) if ("/" in p or "\\" in p)
                  for x in 目录层们(p) if not x.isascii()]
    查("插件声明拼出来的路径,每一层文件夹名都是纯英文(铁律三)"
       + ("" if not 带中文的层 else " ← 命中:" + "、".join(带中文的层)), not 带中文的层)

    子 = None
    try:
        子 = subprocess.Popen(
            [sys.executable, str(本仓 / 声明["起"]["跑"])] + 参数,
            cwd=str(本仓),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONUNBUFFERED": "1"})

        底 = f"http://127.0.0.1:{端口}"

        地址文 = Path(对外提供["配置库"]).parent / "面板地址.txt"
        口令 = ""

        def 拿(路径, 数据=None):
            req = urllib.request.Request(
                底 + 路径,
                data=None if 数据 is None else json.dumps(数据).encode("utf-8"),
                headers={"Content-Type": "application/json", "Cookie": f"k={口令}"})
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read())

        起来了, 网址 = False, ""
        截止 = time.time() + 30
        while time.time() < 截止:
            if 子.poll() is not None:
                break
            try:
                网址 = 地址文.read_text(encoding="utf-8").strip()
                with urllib.request.urlopen(网址, timeout=3) as r:
                    起来了 = r.status == 200
                break
            except Exception:
                time.sleep(0.3)
        口令 = 网址.split("?k=")[-1] if "?k=" in 网址 else ""

        查("照插件声明那条命令起得来,壳读到的那条网址给得出 200(壳等的就是这一下)", 起来了)
        查("面板地址.txt 落在配置库的上一级,里头是声明那个号 + 一串口令(壳只认这一格)"
           + ("" if 网址 else f" ← 没读到 {地址文}"),
           网址.startswith(f"http://127.0.0.1:{端口}/?k=") and len(口令) == 8)
        if not 起来了:
            尾 = ""
            if 子.poll() is not None:
                尾 = (子.stdout.read() or b"").decode("utf-8", "replace")[-500:]
            print("    它最后说的话:" + (尾.strip() or "(没输出)"))
            return

        全 = 拿("/api/state")
        库 = 用户根 / "ai-base" / "配置.db"
        查("库落在插件声明报出去的那个位置,只有这一份(铁律四)"
           + ("" if 库.exists() else f" ← 没落在 {库}"),
           库.exists() and 对外提供.get("配置库") == str(库))

        查("在壳里点开这一屏,看得见供应商列表", len(全["供应商"]) >= 1)
        查("看得见功能列表(每行两个下拉框就挂在这儿)", len(全["功能"]) >= 1)

        谁 = next((x["名"] for x in 全["供应商"] if x["要密钥"]), 全["供应商"][0]["名"])
        坏 = urllib.request.Request(
            底 + "/api/key", data=json.dumps({"供应商": 谁, "密钥": "偷偷改的"}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Origin": "https://evil.example.com"})
        被挡 = False
        try:
            urllib.request.urlopen(坏, timeout=10)
        except Exception as e:
            被挡 = getattr(e, "code", None) == 403
        查("🔴 真起一遍的面板:别的网页背着人 POST 改密钥,当场 403", 被挡)
        查("那一下也确实没改到库里去",
           not next(x for x in 拿("/api/state")["供应商"] if x["名"] == 谁)["有密钥"])

        那行 = 全["功能"][0]
        那家 = next(x for x in 全["供应商"] if x["名"] == 那行["主用供应商"])
        换成 = next((m for m in 那家["模型们"] if m != 那行["主用模型"]), None)
        查("那一家的模型清单里有第二个可选项(下拉框才换得动)", bool(换成))
        if 换成:
            查("点下拉框换模型,存得进",
               拿("/api/route", {"功能名": 那行["功能名"],
                                 "供应商": 那行["主用供应商"], "模型": 换成})["成了"])
            新 = next(x for x in 拿("/api/state")["功能"] if x["功能名"] == 那行["功能名"])
            查("刷新一次,换过的模型还在", 新["主用模型"] == 换成)
    finally:
        if 子 and 子.poll() is None:
            子.kill()
            子.wait(timeout=10)
        shutil.rmtree(用户根, ignore_errors=True)


_接入方脚本 = """
import os, sys
sys.path.insert(0, os.environ["AI_BASE_DIR"])
import ai
ai.加供应商("自检假供应商", "网页接口", sys.argv[1], "假模型")
ai.设密钥("自检假供应商", "sk0000")
# 假供应商住在 127.0.0.1 上,加进去时被自动标成「吃订阅」(本地反代那条猜法),
# 默认关着拨不动 —— 照真人的走法点一次同意,顺带把那道闸也走通一遍。
ai.设同意("自检假供应商", True)
ai.加功能("自检 · 接入方找得到底座", "文本", "自检假供应商", "假模型")
print(ai.问("自检 · 接入方找得到底座", system="s", user="u"))
"""


class _假供应商(BaseHTTPRequestHandler):

    def do_POST(self):
        原 = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        try:
            载 = json.loads(原.decode("utf-8"))
        except Exception:
            载 = {}
        if 载.get("reasoning_effort") == ai._探针值:
            if 载.get("model") == "假模型甲":
                错 = json.dumps({"error": {"message": 'level "x" not supported, '
                                                     'valid levels: low, medium, high'}}).encode()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(错)))
                self.end_headers()
                self.wfile.write(错)
                return
        话 = "假的一句回答"
        末 = (载.get("messages") or [{}])[-1].get("content")
        if isinstance(末, list):
            if 载.get("model") == "假模型乙":
                错 = json.dumps({"error": {"message": "This model does not support image input"}}).encode()
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(错)))
                self.end_headers()
                self.wfile.write(错)
                return
            if 载.get("model") == "假模型甲":
                图 = base64.b64decode(末[1]["image_url"]["url"].split(",", 1)[1])
                话 = "假的一句回答:" + next(c[0] for c in ai._看图色们 if c[1] == ai._纯色图的色(图)) + "色"
        体 = json.dumps({"choices": [{"message": {"content": 话}}]}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(体)))
        self.end_headers()
        self.wfile.write(体)

    def do_GET(self):
        体 = json.dumps({"object": "list",
                         "data": [{"id": "假模型甲",
                                   "architecture": {"input_modalities": ["text", "image"]}},
                                  {"id": "假模型乙"}]}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(体)))
        self.end_headers()
        self.wfile.write(体)

    def log_message(self, *a):
        pass


def 接入方找得到(查):
    import os
    import shutil
    import socket
    import subprocess
    import tempfile

    本仓 = Path(__file__).resolve().parent
    声明 = json.loads((本仓 / "插件.json").read_text(encoding="utf-8"))

    查("「报给接入方」每一项都指向「对外提供」里已有的那一格(同一个路径只写一处)",
       bool(声明.get("报给接入方"))
       and all(v in (声明.get("对外提供") or {}) for v in 声明["报给接入方"].values()))
    查("报出去的正是那两个别人在读的变量名(AI_BASE_DIR 找代码、AI_BASE_DB 找库)",
       set(声明.get("报给接入方") or {}) == {"AI_BASE_DIR", "AI_BASE_DB"})

    根 = Path(tempfile.mkdtemp(prefix="aibase-shell-"))
    代码目录 = 根 / "resources" / "插件" / "ai-base"
    用户根 = 根 / "userroot"
    服务 = None
    try:
        代码目录.mkdir(parents=True)
        用户根.mkdir(parents=True)
        shutil.copy2(本仓 / "ai.py", 代码目录 / "ai.py")
        os.chmod(代码目录, 0o555)

        def 换(s):
            return (s.replace("<用户根>", str(用户根))
                    .replace("<插件根>", str(代码目录))
                    .replace("<端口>", str(声明["起"]["端口"])))

        对外提供 = {k: 换(v) for k, v in 声明["对外提供"].items()}
        环境 = {名: 对外提供[键] for 名, 键 in 声明["报给接入方"].items()}

        服务 = ThreadingHTTPServer(("127.0.0.1", 0), _假供应商)
        threading.Thread(target=服务.serve_forever, daemon=True).start()
        假地址 = f"http://127.0.0.1:{服务.server_address[1]}/v1/chat/completions"

        跑 = subprocess.run([sys.executable, "-c", _接入方脚本, 假地址],
                           cwd=str(根), capture_output=True, text=True, timeout=90,
                           env={**os.environ, **环境})
        查("接入方只按声明找一次,就真调通了一次(没报错)"
           + ("" if 跑.returncode == 0 else " ← 它说:" + (跑.stderr or "").strip()[-300:]),
           跑.returncode == 0 and "假的一句回答" in 跑.stdout)

        库 = Path(环境["AI_BASE_DB"])
        查("库落在可写的那一处,只读的代码目录旁边没有第二份(铁律四)",
           库.exists() and not (代码目录 / "配置.db").exists())
        if 库.exists():
            条 = sum(1 for r in ai.读配置(str(库), 日志条数=50)["日志"]
                     if r["功能"] == "自检 · 接入方找得到底座" and r["成没成"])
            查(f"那一次调用的记录就落在这份可写的库上(数到 {条} 条)", 条 == 1)

        if not os.access(代码目录, os.W_OK):
            少一个 = {k: v for k, v in os.environ.items() if k != "AI_BASE_DB"}
            少一个["AI_BASE_DIR"] = 环境["AI_BASE_DIR"]
            漏 = subprocess.run([sys.executable, "-c", _接入方脚本, 假地址],
                               cwd=str(根), capture_output=True, text=True, timeout=90,
                               env=少一个)
            查("壳要是漏了 AI_BASE_DB,报的是一句说清谁该告诉它的话",
               漏.returncode != 0 and "AI_BASE_DB" in (漏.stderr or "")
               and "没告诉我库落在哪" in (漏.stderr or ""))
    finally:
        if 服务:
            服务.shutdown()
            服务.server_close()
        os.chmod(代码目录, 0o755) if 代码目录.exists() else None
        shutil.rmtree(根, ignore_errors=True)


def 挡住了吗(底, 路径="/api/state", 该给=403, 头=None, 数据=None):
    import urllib.request
    if 头 is None:
        头 = {"Host": "evil.example.com"} if 该给 == 403 else {}
    try:
        urllib.request.urlopen(urllib.request.Request(底 + 路径, data=数据, headers=头), timeout=10)
        return False
    except Exception as e:
        return getattr(e, "code", None) == 该给


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("库路径", nargs="?")
    ap.add_argument("--端口", type=int, default=27183)
    ap.add_argument("--不开", action="store_true")
    ap.add_argument("--局域网", action="store_true")
    ap.add_argument("--自检", action="store_true")
    范围参数 = ap.add_mutually_exclusive_group()
    范围参数.add_argument("--功能声明", action="append")
    范围参数.add_argument("--无已装软件", action="store_true")
    ap.add_argument("--只补功能", action="store_true")
    ap.add_argument("-h", "--help", action="store_true")
    a = ap.parse_args()
    if a.help:
        print(__doc__)
        return 0
    if getattr(a, "自检"):
        return 自检()
    路径们 = [] if a.无已装软件 else a.功能声明
    if a.只补功能 and 路径们 is None:
        ap.error("--只补功能 必须提供 --功能声明 或 --无已装软件")
    try:
        ai._读安装声明(路径们)
        库 = 认库(a.库路径)
        if a.只补功能:
            范围 = ai._同步安装声明(路径们, 库)
            print(json.dumps({k: v for k, v in 范围.items() if k != "声明"}, ensure_ascii=False))
            return 0
        return 起(库, a.端口, not a.不开, a.局域网, 路径们)
    except ai.底座错误 as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

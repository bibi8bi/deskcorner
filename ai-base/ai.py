#!/usr/bin/env python3
"""AI 接入底座:一张表记「哪个功能用哪个模型」,各软件只报功能名、不碰模型。

用法(库路径:环境变量 AI_BASE_DB > 本文件同目录/配置.db,代码里不写死绝对路径):
    python3 ai.py 试 "示例 · 生成" [提问]     # 真跑一次
    python3 ai.py 设密钥 DeepSeek sk-xxxx         # 密钥只落库,不进 git
    python3 ai.py 加供应商 <名> <网页接口|命令行> <网址或命令> [模型清单]  # 加一家新的
    python3 ai.py 名册                            # 看出厂名册里有哪几家能一键加
    python3 ai.py 照名册加 <名册里的名字>          # 照名册加一家:网址 / 模型 / 节流一次带进来
    python3 ai.py 注册页 <供应商名> <网址|空>      # 记下这家去哪领 key(面板上摆一行链接)
    python3 ai.py 只收前缀 <供应商名> <前缀,逗号隔开|空>  # 拉模型列表时只收这几段开头的
    python3 ai.py 免费 <供应商名> <是|否>          # 标一下这家额度要不要钱(只是标签,不挡调用)
    python3 ai.py 强度档 <供应商名> <档,逗号隔开|空>      # 这家自己认哪几档推理强度,从低到高
    python3 ai.py 加功能 "<功能名>" <文本|生图> <供应商名> [模型]  # 挂一件新活上去
    python3 ai.py 问模型 <供应商名>                # 问它要模型列表,覆盖进「模型们」
    python3 ai.py 巡检                            # 各家拉一遍清单 + 真测功能在用的非订阅模型 + 查余额(定时器每天 8 点跑)
    python3 ai.py 查余额 <供应商名>                # 问这家还剩多少钱(现在只有 DeepSeek 有接口)
    python3 ai.py 到期日 <供应商名> <2026-10-01|空>  # 记下这家额度哪天到期,面板上算还剩几天
    python3 ai.py 探档位 <供应商名> <模型>         # 问这个模型认哪几档推理强度(一次请求,几乎不花钱)
    python3 ai.py 挑档 "<族名>" <家>/<模型> …    # 定这条口能选哪几个模型(没列的会被删掉)
    python3 ai.py 删功能 "<功能名>"               # 去掉一行(建全档建出来调不动的那种)
    python3 ai.py 机密 "<功能名>" <是|否>          # 打 / 去「敏感内容」标:带标的整族只许拨 Claude(面板不给改)
    python3 ai.py 同时 "<功能名>" [几个|空]        # 看 / 改这一族批量时同时跑几个(各软件读;空 = 抹掉)
    python3 ai.py 删供应商 "<供应商名>"           # 去掉一整家(没功能拨给它才删得动)
    python3 ai.py 设供应商 "<功能名>" <供应商名> [模型]   # 换某个功能的供应商(面板做出来前先用这条)
    python3 ai.py 出图 "<功能名>" "<提示词>" <存到哪个文件>   # 真画一张,看通不通
    python3 ai.py 限速 "<供应商名>" <隔几秒> <每小时几次>  # 给一家设节流,0 0 = 不限
    python3 ai.py 藏 <供应商名> <模型> [为什么]    # 真打过拨不动的,记一笔;往后拉清单不再显示它
    python3 ai.py 放回 <供应商名> <模型>          # 把藏起来的那个放回来(模型复活了)
    python3 ai.py 藏着的 [供应商名]               # 看现在藏着哪几个、当初为什么藏
    python3 ai.py 开启 <供应商名|全部>             # 吃订阅的那几家默认关着,开了才拨得动
    python3 ai.py 关闭 <供应商名>                  # 关回去
    python3 ai.py 出口                            # 看本机从哪个 IP 出去 + 风险提示
    python3 ai.py 看                              # 列当前配置
    python3 ai.py 自检                            # 不联网的自测

给别的软件用:
    from ai import 问, 问JSON, 画图
    答 = 问("示例 · 生成", system="你是...", user="主题:...")
    图, 格式 = 画图("示例 · 生图", "白底一颗红苹果", 尺寸="1024x1024")
    open("主图" + {"image/png": ".png"}.get(格式, ".jpg"), "wb").write(图)
"""
from __future__ import annotations

import base64
import hashlib
import inspect
import json
import math
import os
import re
import secrets
import shutil
import sqlite3
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib

默认库 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "配置.db")


def 库路径() -> str:
    return os.environ.get("AI_BASE_DB") or 默认库


class 底座错误(RuntimeError):
    pass


class 答非所问(底座错误):
    pass


class 撞上限(底座错误):
    pass


class 功能未登记(底座错误):
    pass


class 缺配置(底座错误):
    pass


class 连不上(底座错误):
    pass


class 机密拒拨(底座错误):
    pass


class 上游报码(底座错误):

    def __init__(self, 话: str, 码: int):
        super().__init__(话)
        self.码 = 码


class 回话截断(底座错误):
    pass


def _截断话(上限: str) -> str:
    return (f"回话太长被截断了(写到{上限}停了),这次不交半截回去。"
            f"把一次要的东西拆小(比如一次少写几页)再问。")


关档 = "关"
_老档名对照 = {"不思考": 关档, "想一会": "low", "好好想": "medium", "使劲想": "high"}
_默认强度档 = {"命令行": ("low", "medium", "high", "xhigh"),
            "网页接口": ("low", "medium", "high")}


def 强度档们(类型: str, 自报: str = "") -> list:
    自 = [x.strip() for x in (自报 or "").split(",") if x.strip()]
    return 自 or list(_默认强度档.get(类型 or "网页接口", _默认强度档["网页接口"]))


_档序 = ("none", "minimal", "low", "medium", "high", "xhigh", "max")

_档位来源 = ("接口自报", "不吃这一格", "探不出来")


def 模型档位(类型: str, 地址: str, 模型: str, 笔=None, 家自报: str = "") -> dict:
    候选 = 强度档们(类型, 家自报)
    if 笔 is None:
        return {"档们": 候选, "来源": "没探过", "探于": "", "过期": False}
    来源 = (笔["档位来源"] if "档位来源" in 笔.keys() else "") or ""
    if 来源 not in _档位来源:
        return {"档们": 候选, "来源": "没探过", "探于": "", "过期": False}
    过期 = (笔["档位指纹"] if "档位指纹" in 笔.keys() else "") != _通道指纹(类型, 地址, 模型)
    档们 = 排档((笔["强度档"] or "").split(","))
    探于 = (笔["档位探于"] if "档位探于" in 笔.keys() else "") or ""
    if 过期:
        return {"档们": 档们 or 候选, "来源": "没探过", "探于": 探于, "过期": True}
    if 来源 == "接口自报":
        return {"档们": 档们 or 候选, "来源": 来源, "探于": 探于, "过期": False}
    if 来源 == "不吃这一格":
        return {"档们": [], "来源": 来源, "探于": 探于, "过期": False}
    return {"档们": 候选, "来源": 来源, "探于": 探于, "过期": False}


def _通道指纹(类型: str, 地址: str, 模型: str) -> str:
    return f"{(类型 or '').strip()}|{(地址 or '').strip()}|{(模型 or '').strip()}"


def 排档(档们) -> list:
    净, 见过 = [], set()
    for x in (档们 or ()):
        x = (x or "").strip()
        if x and x != 关档 and x not in 见过:
            见过.add(x)
            净.append(x)
    return sorted([x for x in 净 if x in _档序], key=_档序.index) + [x for x in 净 if x not in _档序]


建表 = """
CREATE TABLE IF NOT EXISTS 安装声明 (唯一 INTEGER PRIMARY KEY CHECK(唯一=1));
CREATE TABLE IF NOT EXISTS 供应商 (
    名 TEXT PRIMARY KEY,
    类型 TEXT NOT NULL DEFAULT '网页接口',   -- 网页接口 | 命令行
    地址 TEXT,
    密钥 TEXT,
    备注 TEXT,
    模型们 TEXT,     -- 逗号分隔,面板的模型下拉框吃它;填不在清单里的也允许
    强度档 TEXT,     -- 逗号分隔,这一家**自己**认的推理强度值(见 _默认强度档);空 = 按类型取默认
    最小间隔秒 REAL NOT NULL DEFAULT 0,   -- 两次调用至少隔这么久,0 = 不限
    每小时上限 INTEGER NOT NULL DEFAULT 0, -- 一小时最多这么多次,0 = 不限
    吃订阅 INTEGER NOT NULL DEFAULT 0,    -- 1 = 烧的是你自己账号的订阅额度,有账号被限制的风险
    免费 INTEGER NOT NULL DEFAULT 0,      -- 1 = 这家的额度不要钱。**它不是闸,是个标签**:
                                          -- 不挡任何调用,只让面板知道「这家不该算成正经主力」
    已同意 TEXT,    -- 人点过「我知道有账号风险,开启」的那一刻;空 = 没点过 = 吃订阅的那几家拨不动
    -- 「拉取模型列表」只留名字以这里某一段开头的模型;空 = 全收(绝大多数家都是空)。
    -- 逗号分隔。为什么要有它:同一个地址上可能混着好几家的模型(比如 CPA 反代上 gpt / gemini 混着),
    -- 拆成两家分开管时要是不滤,两家一点「拉取模型列表」就又各自拉回全部,拆了等于没拆。
    只收前缀 TEXT,
    -- 去哪领这家的 key(直达注册页)。从厂商名册抄过来的,面板那张卡上摆一行「去这里领 key →」。
    -- **它只是个链接,不参与拨号**;空 = 名册里本来就没有出处,别猜一个填进去。
    注册页 TEXT,
    -- 这家还剩多少。
    -- 余额 = 最近一次拿到的那句话(查余额接口回的钱数,或 Groq 回包头里的今天剩余次数),
    -- 余额于 = 拿到的那一刻;都空 = 从没拿到过。**不参与拨号**,只给人看。
    余额 TEXT,
    余额于 TEXT,
    -- 人手填的到期日(YYYY-MM-DD),订阅 / 免费额度 / 充值包哪天到期。空 = 没填。
    到期日 TEXT,
    -- 上次「问模型清单」成功拉回来的那一刻(每日巡检和人点「检查更新」都算)。空 = 没拉过。
    -- 模型更新页的「上次检查」读它(2026-10-04:只记手点的那次很别扭)。**不参与拨号、不进预览指纹**。
    清单于 TEXT
);
CREATE TABLE IF NOT EXISTS 功能 (
    功能名 TEXT PRIMARY KEY,
    主用供应商 TEXT,
    主用模型 TEXT,
    备用供应商 TEXT,
    备用模型 TEXT,
    种类 TEXT NOT NULL DEFAULT '文本',  -- 文本 = 要一段话,走 问();生图 = 要一张图,走 画图()
    启用 INTEGER NOT NULL DEFAULT 1,    -- 0 = 这一行留着但不报给接入方,它那边的下拉框里就没这一项
    用力 TEXT NOT NULL DEFAULT '关',  -- 推理强度:'关' 或这一家原厂认的那个值(low/medium/high/xhigh…)
    说明 TEXT,  -- 这条功能是哪个软件、哪个页面在用。**会话写的**,面板上只读不给改
    备注 TEXT,  -- 人自己写的一句。跟 模型笔记 那张表「备注 = 人写的 / 判断 = 会话写的」同一个分工
    -- 这一行归哪条口管(它上头那条功能的全名)。空 = 它自己就是一条口的头行。
    -- **面板的分组只认这一格**,不从名字砍最后一截倒推:
    -- 供应商的名字自己就可能带一个「 · 」(比如「CPA 反代 · GPT」),砍出来的爹是个库里不存在的名字,
    -- 那一档就被分进一个不存在的组里,跟它的兄弟们并排出现两条同名的口。
    -- 谁往这一格写:加备选 / 设档(它俩本来就知道要挂给哪条口)、加功能 与老库迁移(_认爹 算一次)。
    -- 名字规矩一个字没改 —— 接入方照旧按「名字以族名开头」认一族,这一列不给它看。
    父功能 TEXT,
    -- 同一条口里谁先谁后:小的在前,**头行不看这一格、永远排第一**(它就是 问(族名) 先打的那一行)。
    -- 原来先后只靠功能名排,
    -- 自动起名的备选行名字改成跟着设定走以后,一改名位置就跳,所以先后单存一格。
    -- 新行排最后(MAX+1);空着的由 _补顺序 在连库时按功能名补上。排法只住 _族内序 一处。
    顺序 INTEGER,
    不提新版 INTEGER NOT NULL DEFAULT 0,
    -- 1 = 这条口处理敏感内容,只许拨 Anthropic(见 是Anthropic / 机密拒拨)。**只认头行这一格**,
    -- 备选行跟着头行走、自己那格不看。面板只显示不给改,打 / 去标只走命令行 `机密`。
    客户机密 INTEGER NOT NULL DEFAULT 0,
    -- 接入方批量调这条口时同时开几路。
    -- NULL = 没设,接入方用自己的老数。**只认头行这一格**;底座自己不按它限流(_限速 管的是发起间隔)。
    同时 INTEGER
);
CREATE TABLE IF NOT EXISTS 发号 (
    谁 TEXT,
    时刻 REAL      -- unix 秒。限速的账记在这儿,不记在日志表(日志是「调完了」,这儿是「准你发」)
);
CREATE INDEX IF NOT EXISTS 发号_谁时 ON 发号(谁, 时刻);
CREATE TABLE IF NOT EXISTS 出口 (
    时刻 TEXT,
    地址 TEXT      -- 本机请求出去时对方看到的 IP
);
-- 一个模型一行。**藏起来的和没藏的都住这儿**:从原来那张只记「藏了哪几个」的
-- 藏起来 表长出来的 —— 要在面板上看见每个模型的备注 / 判断 / 通不通,那几格对没藏的
-- 那些模型也得有地方存。所以是给原来那张表加列,不是另开一张(同一件事只存一处)。
CREATE TABLE IF NOT EXISTS 模型笔记 (
    供应商 TEXT,
    模型 TEXT,
    备注 TEXT,      -- 人自己写的一句。藏起来的那些,这一格就是「当初为什么摁下去」
    判断 TEXT,      -- 这个模型适合干什么、别拿它干什么。会话填的多,人也能在面板上改
    连通 TEXT,      -- '通' | '不通' | ''(没测过)。只有真发过一次才写得进来
    测于 TEXT,      -- 上次真打的那一刻
    测出的话 TEXT,  -- 那次回来的原话:通了记答案头一小段,没通记报错原文(已抹掉密钥)
    藏了 INTEGER NOT NULL DEFAULT 0,  -- 1 = 清单里灰着、点「拉取模型列表」也不放它回来
    何时 TEXT,      -- 摁下去的那一刻
    -- ↓ 这四格一起说一件事:「这个模型的推理强度到底认哪几档」。**只有探过才写得进来**,
    --   跟 连通 那一格同一个脾气 —— 没探过就空着,面板照实说「没探过」,不拿默认清单冒充。
    强度档 TEXT,     -- 逗号分隔,接口自己列出来的合法档,已按 _档序 从低到高排好
    档位来源 TEXT,   -- _档位来源 里的一个;空 = 没探过
    档位探于 TEXT,   -- 探的那一刻
    档位指纹 TEXT,   -- 探的时候这条通道的样子(见 _通道指纹)。对不上 = 这份清单过期了
    -- ↓ 要在面板上看出「哪个能看图、哪个快哪个慢」。
    看图 TEXT,       -- '能' | '不能' | ''(还不知道)。只有清单自己写着、或「测试」真递过图才写得进来
    看图来源 TEXT,   -- '清单自报' | '测试'(老库残留的 '这条路递不进' 连库时清空)。拉清单**不许盖掉**「测试」测出来的
    测速毫秒 INTEGER, -- 上次「测试」成了的那一问用了多久(节流等待不算,跟日志 耗时毫秒 同一个口径);没通就清空
    -- ↓ 哪些模型免费,单独一列。按模型记,不是按家 ——
    --   同一家里常常只有一两个免费(智谱只有 glm-4.7-flash),供应商那格「免费」说不清这件事。
    免费 TEXT,       -- '免费' | '收费' | '查不到' | ''(没查过)。会话照官网定价页查了才写,不按名字猜
    免费出处 TEXT,   -- 查的哪一页、哪天查的、原文短引。面板悬浮里给人看
    PRIMARY KEY (供应商, 模型)
);
-- 一个项目一行(项目 = 功能名最前面那一截,比如「待办」)。
-- **只给面板的区头用**,底座自己一个字都不读 —— 它不参与路由、不进请求。
-- 为什么单开一张表:项目不是实体,是从功能名切出来的一截,没有哪一行能挂这两格;
-- 塞进 功能 表就得选一行当代表,那一行一删这两格跟着没,而项目还在(第二个真相源)。
CREATE TABLE IF NOT EXISTS 项目笔记 (
    项目名 TEXT PRIMARY KEY,
    备注 TEXT,   -- 人写的一句,显示在区头项目名后面
    网址 TEXT    -- 那个软件自己的页面。区头那颗「打开」钮点的就是它;只收 http/https
);
CREATE TABLE IF NOT EXISTS 日志 (
    时刻 TEXT,
    功能 TEXT,
    用了谁 TEXT,
    模型 TEXT,
    成没成 INTEGER,
    耗时毫秒 INTEGER,
    报错原文 TEXT,
    想了 INTEGER,  -- 这一次接口报的思考 token 数(见 _想了多少)。NULL = 这家没报,不是 0
    用力 TEXT      -- 这一次发出去时选的推理强度。想了多少只有配着它才说明得了问题
);
"""

_DS模型 = "deepseek-flash,deepseek-v4-pro"
_CL模型 = "sonnet,opus,haiku"
_禁用模型词 = ("fable",)


def _禁用模型(名: str) -> bool:
    return any(w in (名 or "").lower() for w in _禁用模型词)


def _拦禁用模型(模型: str) -> None:
    if _禁用模型(模型):
        raise 底座错误(f"「{模型}」是 fable 模型,底座里不许设定(太烧额度),请换 sonnet / opus / haiku")

_说生成 = "示例软件:点「生成」时调,按给的内容写一段话"
_说审修 = "示例软件:把写好的文字改顺一遍"

_出厂照名册 = ("Groq",)


def _出厂建名册那几家(conn) -> None:
    for 名 in _出厂照名册:
        条 = 名册一家(名)
        if not 条:
            continue
        if conn.execute("SELECT 1 FROM 供应商 WHERE 名=?", (名,)).fetchone():
            continue
        conn.execute(
            "INSERT INTO 供应商(名,类型,地址,密钥,备注,模型们,强度档,最小间隔秒,每小时上限,"
            "吃订阅,免费,只收前缀,注册页) VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,?)",
            (名, str(条["类型"]), str(条["地址"]), str(条.get("备注") or ""),
             str(条.get("模型们") or ""), str(条.get("强度档") or ""),
             float(条.get("最小间隔秒") or 0), int(条.get("每小时上限") or 0),
             1 if 条.get("吃订阅") else 0, 1 if 条.get("免费") else 0,
             str(条.get("只收前缀") or ""), str(条.get("注册页") or "")))


本机增强文件 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "本机增强.json")


def 本机增强() -> list[dict]:
    if not os.path.exists(本机增强文件):
        return []
    try:
        with open(本机增强文件, encoding="utf-8") as f:
            家们 = json.load(f)["家们"]
        for 条 in 家们:
            if not all(isinstance(条.get(k), str) and 条[k].strip() for k in ("名", "类型", "地址")):
                raise ValueError("每家必须有 名 / 类型 / 地址")
            if 条["类型"] not in ("网页接口", "命令行"):
                raise ValueError(f"「{条['名']}」的类型只能是 网页接口 或 命令行")
        return 家们
    except (OSError, ValueError, KeyError, TypeError) as e:
        raise 底座错误(f"本机增强读不动({本机增强文件}):{e}") from e


def _出厂建本机增强(conn) -> None:
    for 条 in 本机增强():
        模型们 = str(条.get("模型们") or (_CL模型 if 条["类型"] == "命令行" else ""))
        conn.execute("INSERT OR IGNORE INTO 供应商(名,类型,地址,密钥,备注,模型们) VALUES(?,?,?,NULL,?,?)",
                     (条["名"], 条["类型"], 条["地址"], str(条.get("备注") or ""), 模型们))
        conn.execute("UPDATE 供应商 SET 模型们=? WHERE 名=? AND IFNULL(模型们,'')=''", (模型们, 条["名"]))
        if 条.get("吃订阅"):
            conn.execute("UPDATE 供应商 SET 吃订阅=1 WHERE 名=?", (条["名"],))


默认行 = [
    ("INSERT OR IGNORE INTO 供应商(名,类型,地址,密钥,备注,模型们) VALUES(?,?,?,?,?,?)",
     ("DeepSeek", "网页接口", "https://api.deepseek.com/chat/completions", None,
      "填个 key 就能用", _DS模型)),
    ("UPDATE 供应商 SET 模型们=? WHERE 名=? AND IFNULL(模型们,'')=''", (_DS模型, "DeepSeek")),
    ("INSERT OR IGNORE INTO 功能(功能名,主用供应商,主用模型,说明) VALUES(?,?,?,?)",
     ("示例 · 生成", "DeepSeek", _DS模型.split(",")[0], _说生成)),
    ("INSERT OR IGNORE INTO 功能(功能名,主用供应商,主用模型,说明) VALUES(?,?,?,?)",
     ("示例 · 润色", "DeepSeek", _DS模型.split(",")[0], _说审修)),
    ("UPDATE 功能 SET 说明=? WHERE 功能名=? AND IFNULL(说明,'')=''", (_说生成, "示例 · 生成")),
    ("UPDATE 功能 SET 说明=? WHERE 功能名=? AND IFNULL(说明,'')=''", (_说审修, "示例 · 润色")),
]


def _读安装声明(路径们):
    if 路径们 is None:
        return {"已知": False, "功能名": [], "声明错误": [], "声明": []}
    行们, 名们, 文件们, 软件们 = [], set(), set(), set()
    for 路径 in 路径们:
        try:
            路径 = os.path.realpath(os.fspath(路径))
            if 路径 in 文件们:
                raise ValueError("声明路径重复")
            文件们.add(路径)
            with open(路径, encoding="utf-8") as f:
                文 = json.load(f)
            if not isinstance(文, dict) or not isinstance(文.get("名"), str) or not 文["名"].strip():
                raise ValueError("缺少软件名")
            if 文["名"] in 软件们:
                raise ValueError("软件名重复")
            软件们.add(文["名"])
            声明 = 文.get("AI功能")
            if not isinstance(声明, dict) or set(声明) != {"版本", "功能"}:
                raise ValueError("AI功能 必须包含版本和功能")
            if type(声明["版本"]) is not int or 声明["版本"] != 1:
                raise ValueError("不支持的 AI功能 版本")
            if not isinstance(声明["功能"], list):
                raise ValueError("功能必须是数组")
            标识们 = set()
            for 行 in 声明["功能"]:
                if not isinstance(行, dict) or set(行) != {"标识", "功能名", "种类", "说明"}:
                    raise ValueError("功能只收标识、功能名、种类、说明四字段")
                if any(not isinstance(v, str) or not v.strip() or v != v.strip() for v in 行.values()):
                    raise ValueError("功能字段必须是无首尾空白的非空字符串")
                if 行["种类"] not in ("文本", "看图", "生图"):
                    raise ValueError("种类只收文本、看图、生图")
                if 行["标识"] in 标识们 or 行["功能名"] in 名们:
                    raise ValueError("标识或功能名重复，取消整批补行")
                标识们.add(行["标识"])
                名们.add(行["功能名"])
                行们.append(行)
        except (OSError, ValueError, TypeError) as e:
            raise 底座错误(f"功能声明读取失败：{路径}：{e}") from e
    return {"已知": True, "功能名": [r["功能名"] for r in 行们], "声明错误": [], "声明": 行们}


def _能力候选(种类, 供应商们):
    册 = 名册() if 种类 == "生图" else []
    出 = []
    for 供 in 供应商们:
        笔 = {n["模型"]: n for n in 供["模型笔记"]}
        for 模型 in 供["模型们"]:
            记 = 笔.get(模型, {})
            if 记.get("藏了") or (供.get("只收前缀") and not _对得上前缀(模型, [x.strip() for x in re.split(r"[,，]", 供["只收前缀"]) if x.strip()])):
                continue
            if 种类 == "看图":
                能 = 供["递得进图"] and 记.get("看图") == "能" and 记.get("看图来源") in ("清单自报", "测试")
            elif 种类 == "生图":
                能 = 供["类型"] == "网页接口" and any(
                    (c.get("种类") == "生图" or str(c.get("地址", "")).rstrip("/").endswith("/images/generations"))
                    and c.get("地址") == 供["地址"]
                    and 模型 in [m.strip() for m in str(c.get("模型们", "")).split(",")]
                    for c in 册) and bool(生图路子(供["地址"]))
            else:
                能 = 供["类型"] == "命令行" or (供["类型"] == "网页接口" and 供["地址"].rstrip("/").endswith("/chat/completions"))
            if 能:
                出.append((供, 模型))
    return sorted(出, key=lambda x: (bool(x[0]["拨不动理由"]), x[0]["吃订阅"], x[0]["名"], x[1]))


def _需求理由(conn, 行, 需求=None):
    需求 = 需求 or (行["需求种类"] if "需求种类" in 行.keys() else "")
    if not 需求 and 行["父功能"]:
        父 = conn.execute("SELECT 需求种类 FROM 功能 WHERE 功能名=?", (行["父功能"],)).fetchone()
        需求 = 父[0] if 父 else None
    if not 需求:
        return ""
    if not 行["主用供应商"] or not 行["主用模型"]:
        return f"待配置：请选择支持{需求}的模型"
    if 需求 == "文本":
        return ""
    供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (行["主用供应商"],)).fetchone()
    if not 供:
        return f"待配置：请选择支持{需求}的供应商"
    笔 = [dict(r) for r in conn.execute("SELECT * FROM 模型笔记 WHERE 供应商=?", (供["名"],))]
    资 = dict(供)
    资.update(模型笔记=笔, 模型们=[行["主用模型"]], 递得进图=_递得进图(供["类型"]), 拨不动理由="")
    if not _能力候选(需求, [资]):
        return f"待配置：当前模型缺少{需求}能力记录"
    return ""


def _同步安装声明(路径们, 库=None):
    范围 = _读安装声明(路径们)
    if not 范围["已知"]:
        return 范围
    conn = 连库(库, _按声明=True)
    try:
        供应商们 = 读配置(库)["供应商"]
        conn.execute("BEGIN IMMEDIATE")
        for 行 in 范围["声明"]:
            if conn.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (行["功能名"],)).fetchone():
                continue
            if 行["种类"] == "文本":
                家, 模型 = "DeepSeek", _DS模型.split(",")[0]
            else:
                候选 = _能力候选(行["种类"], 供应商们)
                家, 模型 = (候选[0][0]["名"], 候选[0][1]) if 候选 else ("", "")
            conn.execute(
                "INSERT INTO 功能(功能名,主用供应商,主用模型,种类,说明,父功能,顺序,需求种类) "
                "VALUES(?,?,?,?,?,'',(SELECT IFNULL(MAX(顺序),0)+1 FROM 功能),?)",
                (行["功能名"], 家, 模型, "生图" if 行["种类"] == "生图" else "文本", 行["说明"], 行["种类"]))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 范围


def _安装范围状态(状态, 范围, 库=None):
    出 = {k: v for k, v in 范围.items() if k != "声明"}
    if not 范围["已知"]:
        return 出
    名们 = set(范围["功能名"])
    族名们 = {f["功能名"] for f in 状态["功能"] if f["功能名"] in 名们 or f["父功能"] in 名们}
    conn = 连库(库)
    try:
        需求们 = {r["功能名"]: r["种类"] for r in 范围["声明"]}
        for f in 状态["功能"]:
            需求 = 需求们.get(f["功能名"]) or 需求们.get(f["父功能"])
            if 需求:
                不符 = (f["种类"] == "生图") != (需求 == "生图")
                f["拨不动理由"] = ("声明需求与现有种类不符" if 不符 else _需求理由(conn, f, 需求)) or f["拨不动理由"]
        出["已调用"] = any(r[0] in 族名们 for r in conn.execute("SELECT DISTINCT 功能 FROM 日志"))
    finally:
        conn.close()
    需求 = {r["种类"] for r in 范围["声明"]}
    出["供应商就绪"] = all(any(not s["拨不动理由"] and not s["吃订阅"] and not s["免费"]
                                  for s, _ in _能力候选(种, 状态["供应商"])) for 种 in 需求)
    return 出


def _认爹(功能名: str, 有的名: set) -> str:
    段 = (功能名 or "").split(" · ")
    if len(段) <= 2:
        return ""
    for i in range(len(段) - 1, 1, -1):
        爹 = " · ".join(段[:i])
        if 爹 in 有的名:
            return 爹
    return " · ".join(段[:-1])


_编号种 = (("供应商", "GS"), ("功能", "GN"), ("日志", "RZ"))


def _编号(前缀: str, 号) -> str:
    return f"{前缀}{int(号):04d}" if 号 else ""


def _补编号(conn) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS 编号计数 (种 TEXT PRIMARY KEY, 末号 INTEGER NOT NULL DEFAULT 0)")
    for 表, _ in _编号种:
        conn.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS {表}_号 ON {表}(号)")
        conn.execute(
            f"CREATE TRIGGER IF NOT EXISTS {表}_发编号 AFTER INSERT ON {表} WHEN NEW.号 IS NULL BEGIN"
            f" INSERT OR IGNORE INTO 编号计数(种, 末号) VALUES('{表}', 0);"
            f" UPDATE 编号计数 SET 末号 = MAX(末号, (SELECT IFNULL(MAX(号), 0) FROM {表})) + 1 WHERE 种 = '{表}';"
            f" UPDATE {表} SET 号 = (SELECT 末号 FROM 编号计数 WHERE 种 = '{表}') WHERE rowid = NEW.rowid;"
            f" END")
    缺 = [表 for 表, _ in _编号种 if conn.execute(f"SELECT 1 FROM {表} WHERE 号 IS NULL LIMIT 1").fetchone()]
    if not 缺:
        return
    conn.execute("BEGIN IMMEDIATE")
    try:
        for 表 in 缺:
            末 = conn.execute(f"SELECT IFNULL(MAX(号), 0) FROM {表}").fetchone()[0]
            计 = conn.execute("SELECT 末号 FROM 编号计数 WHERE 种=?", (表,)).fetchone()
            底 = max(末, 计[0] if 计 else 0)
            起 = conn.execute(f"SELECT MIN(rowid) FROM {表} WHERE 号 IS NULL").fetchone()[0]
            if 起 is None:
                continue
            conn.execute(f"UPDATE {表} SET 号 = ? + rowid - ? + 1 WHERE 号 IS NULL", (底, 起))
            conn.execute("INSERT OR IGNORE INTO 编号计数(种, 末号) VALUES(?, 0)", (表,))
            conn.execute(f"UPDATE 编号计数 SET 末号 = (SELECT MAX(号) FROM {表}) WHERE 种=?", (表,))
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise


def 连库(路径: str | None = None, *, _按声明=False) -> sqlite3.Connection:
    路 = 路径 or 库路径()
    try:
        上层 = os.path.dirname(路)
        if 上层 and not os.path.isdir(上层):
            os.mkdir(上层)
        return _连库(路, _按声明=_按声明)
    except (sqlite3.OperationalError, OSError) as e:
        raise 底座错误(
            f"打不开配置库 {路}({e})。"
            + ("起底座的那个程序没告诉我库落在哪 —— 它该用环境变量 AI_BASE_DB 指过来"
               "(安装壳照 插件.json 的「报给接入方」注入)。"
               if not os.environ.get("AI_BASE_DB")
               else "AI_BASE_DB 指的就是这个位置 —— 它上一层的文件夹不在,或者那儿写不进去。"
                    "只替你补最后一级是故意的:路径打错了就该在这儿停住,"
                    "不该顺着错的路建出一份空库,那份空库谁也查不出来。")
        ) from e


def _补测速(conn):
    conn.execute(
        "UPDATE 模型笔记 SET 测速毫秒=(SELECT 日志.耗时毫秒 FROM 日志"
        " WHERE 日志.功能='(连通测试)' AND 日志.成没成=1"
        " AND 日志.用了谁=模型笔记.供应商 AND 日志.模型=模型笔记.模型"
        " AND 日志.时刻<=模型笔记.测于 AND 日志.时刻>=datetime(模型笔记.测于,'-5 seconds')"
        " ORDER BY 日志.rowid DESC LIMIT 1)"
        " WHERE 连通='通' AND IFNULL(测于,'')<>''")


def _连库(路: str, *, _按声明=False) -> sqlite3.Connection:
    conn = sqlite3.connect(路, timeout=60)
    conn.row_factory = sqlite3.Row
    conn.isolation_level = None
    conn.executescript(建表)
    if _按声明:
        conn.execute("INSERT OR IGNORE INTO 安装声明 VALUES(1)")
    按声明 = bool(conn.execute("SELECT 1 FROM 安装声明").fetchone())
    for 表, 列 in (("功能", "需求种类 TEXT"), ("供应商", "模型们 TEXT"),
                  ("供应商", "最小间隔秒 REAL NOT NULL DEFAULT 0"),
                  ("供应商", "每小时上限 INTEGER NOT NULL DEFAULT 0"),
                  ("供应商", "吃订阅 INTEGER NOT NULL DEFAULT 0"),
                  ("供应商", "免费 INTEGER NOT NULL DEFAULT 0"),
                  ("供应商", "已同意 TEXT"),
                  ("供应商", "强度档 TEXT"),
                  ("功能", "种类 TEXT NOT NULL DEFAULT '文本'"),
                  ("功能", "启用 INTEGER NOT NULL DEFAULT 1"),
                  ("功能", "用力 TEXT NOT NULL DEFAULT '关'"),
                  ("功能", "说明 TEXT"),
                  ("功能", "备注 TEXT"),
                  ("功能", "父功能 TEXT"),
                  ("功能", "不提新版 INTEGER NOT NULL DEFAULT 0"),
                  ("功能", "客户机密 INTEGER NOT NULL DEFAULT 0"),
                  ("功能", "同时 INTEGER"),
                  ("供应商", "只收前缀 TEXT"),
                  ("供应商", "注册页 TEXT"),
                  ("供应商", "余额 TEXT"),
                  ("供应商", "余额于 TEXT"),
                  ("供应商", "到期日 TEXT"),
                  ("供应商", "清单于 TEXT"),
                  ("日志", "想了 INTEGER"),
                  ("日志", "用力 TEXT"),
                  ("模型笔记", "强度档 TEXT"),
                  ("模型笔记", "档位来源 TEXT"),
                  ("模型笔记", "档位探于 TEXT"),
                  ("模型笔记", "档位指纹 TEXT"),
                  ("模型笔记", "看图 TEXT"),
                  ("模型笔记", "看图来源 TEXT"),
                  ("模型笔记", "测速毫秒 INTEGER"),
                  ("模型笔记", "免费 TEXT"),
                  ("模型笔记", "免费出处 TEXT"),
                  ("供应商", "号 INTEGER"),
                  ("功能", "号 INTEGER"),
                  ("日志", "号 INTEGER")):
        try:
            conn.execute(f"ALTER TABLE {表} ADD COLUMN {列}")
        except sqlite3.OperationalError:
            continue
        if 列.startswith("测速毫秒"):
            _补测速(conn)
    _补编号(conn)
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='藏起来'").fetchone():
        conn.execute("INSERT OR IGNORE INTO 模型笔记(供应商,模型,备注,藏了,何时) "
                     "SELECT 供应商,模型,为什么,1,何时 FROM 藏起来")
        conn.execute("DROP TABLE 藏起来")
    for 旧, 新 in ([] if 按声明 else _老档名对照.items()):
        conn.execute("UPDATE 功能 SET 用力=? WHERE 用力=?", (新, 旧))
    conn.execute("UPDATE 模型笔记 SET 看图=NULL, 看图来源=NULL WHERE 看图来源='这条路递不进'")
    for sql, 参 in 默认行:
        if 按声明 and "功能" in sql:
            continue
        conn.execute(sql, 参)
    _出厂建本机增强(conn)
    _出厂建名册那几家(conn)
    待填 = [r[0] for r in conn.execute("SELECT 功能名 FROM 功能 WHERE 父功能 IS NULL")]
    if 待填 and not 按声明:
        有的名 = {r[0] for r in conn.execute("SELECT 功能名 FROM 功能")}
        for 名 in 待填:
            conn.execute("UPDATE 功能 SET 父功能=? WHERE 功能名=?", (_认爹(名, 有的名), 名))
    if 按声明:
        if not any(r[1] == "顺序" for r in conn.execute("PRAGMA table_info(功能)")):
            conn.execute("ALTER TABLE 功能 ADD COLUMN 顺序 INTEGER")
    else:
        _补顺序(conn)
    conn.commit()
    return conn


_族内序 = "顺序 IS NULL, 顺序, 功能名"
_插功能行 = ("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,父功能,顺序) "
          "VALUES(?,?,?,?,?,(SELECT IFNULL(MAX(顺序),0)+1 FROM 功能))")


def _补顺序(conn) -> None:
    有列 = lambda: any(r[1] == "顺序" for r in conn.execute("PRAGMA table_info(功能)"))
    if 有列() and not conn.execute("SELECT 1 FROM 功能 WHERE 顺序 IS NULL LIMIT 1").fetchone():
        return
    conn.execute("BEGIN IMMEDIATE")
    try:
        头一回 = not 有列()
        if 头一回:
            conn.execute("ALTER TABLE 功能 ADD COLUMN 顺序 INTEGER")
        底 = conn.execute("SELECT IFNULL(MAX(顺序),0) FROM 功能").fetchone()[0]
        空的 = [r[0] for r in conn.execute("SELECT 功能名 FROM 功能 WHERE 顺序 IS NULL ORDER BY 功能名")]
        for i, 名 in enumerate(空的, 1):
            conn.execute("UPDATE 功能 SET 顺序=? WHERE 功能名=?", (底 + i, 名))
        if 头一回:
            for 头 in [r[0] for r in conn.execute(
                    "SELECT DISTINCT 父功能 FROM 功能 WHERE IFNULL(父功能,'')<>'' ORDER BY 父功能")]:
                _名随设定(conn, 头)
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise


def _名随设定(conn, 头: str) -> dict:
    前 = 头 + " · "
    行们 = [r for r in conn.execute(
        f"SELECT 功能名, 主用供应商, 主用模型 FROM 功能 WHERE 父功能=? ORDER BY {_族内序}", (头,))
        if r["功能名"].startswith(前) and "/" in r["功能名"][len(前):]]
    if not 行们:
        return {}
    自动名 = {r["功能名"] for r in 行们}
    占着 = {r[0] for r in conn.execute("SELECT 功能名 FROM 功能")} - 自动名
    想要 = {}
    for r in 行们:
        家, 模 = (r["主用供应商"] or "").strip(), (r["主用模型"] or "").strip()
        想要[r["功能名"]] = _自动档名(头, 家, 模) if 家 and 模 else r["功能名"]
    分到: dict = {}
    for r in 行们:
        旧 = r["功能名"]
        if 想要[旧] == 旧 and 旧 not in 占着:
            分到[旧] = 旧
            占着.add(旧)
    for r in 行们:
        旧 = r["功能名"]
        if 旧 in 分到:
            continue
        if 想要[旧] not in 占着:
            分到[旧] = 想要[旧]
        elif 旧 not in 占着:
            分到[旧] = 旧
        else:
            raise 底座错误(f"「{头}」底下有两行拨的都是 {想要[旧].split(' · ')[-1]},"
                        "名字排不开 —— 先删掉重复的那一行再改")
        占着.add(分到[旧])
    改 = {旧: 新 for 旧, 新 in 分到.items() if 旧 != 新}
    for i, 旧 in enumerate(改):
        conn.execute("UPDATE 功能 SET 功能名=? WHERE 功能名=?", (f"{前}(改名中 {i})", 旧))
    for i, (旧, 新) in enumerate(改.items()):
        conn.execute("UPDATE 功能 SET 功能名=? WHERE 功能名=?", (新, f"{前}(改名中 {i})"))
    for 旧 in set(改) - set(改.values()):
        conn.execute("UPDATE 日志 SET 功能=? WHERE 功能=?", (改[旧], 旧))
    return 改


_UA = "ai-base/1.0"


def _头(密钥: str, 地址: str = "") -> dict:
    公共 = {"Content-Type": "application/json", "User-Agent": _UA}
    if ":generateContent" in (地址 or ""):
        return {"x-goog-api-key": 密钥, **公共}
    return {"Authorization": f"Bearer {密钥}", **公共}


def _打(地址: str, 密钥: str, 载荷: dict, 超时: int, 收: dict | None = None) -> dict:
    请求 = urllib.request.Request(
        地址,
        data=json.dumps(载荷).encode("utf-8"),
        headers=_头(密钥, 地址),
        method="POST",
    )
    with urllib.request.urlopen(请求, timeout=超时) as 回:
        if 收 is not None:
            收["剩余"] = _剩余次数(getattr(回, "headers", None))
        return json.loads(回.read().decode("utf-8"))


def _剩余次数(头) -> str | None:
    if 头 is None:
        return None
    剩, 限 = 头.get("x-ratelimit-remaining-requests"), 头.get("x-ratelimit-limit-requests")
    if not (剩 or "").strip().isdigit():
        return None
    return f"今天还剩 {剩.strip()}" + (f"/{限.strip()}" if (限 or "").strip().isdigit() else "") + " 次"


def _打多段(地址: str, 密钥: str, 载荷: bytes, 内容类型: str, 超时: int) -> dict:
    请求 = urllib.request.Request(
        地址,
        data=载荷,
        headers={**_头(密钥, 地址), "Content-Type": 内容类型},
        method="POST",
    )
    with urllib.request.urlopen(请求, timeout=超时) as 回:
        return json.loads(回.read().decode("utf-8"))


def _发网页请求(地址: str, 密钥: str, 载荷: dict, 超时: int, 收: dict | None = None) -> str:
    体 = _打(地址, 密钥, 载荷, 超时, 收)
    if 收 is not None:
        收["想了"] = _想了多少(体, 地址)
    if (体["choices"][0].get("finish_reason") or "") == "length":
        raise 回话截断(_截断话(f" {载荷.get('max_tokens') or '输出'} token 上限"))
    return 体["choices"][0]["message"]["content"]


def _想了多少(体: dict, 地址: str = ""):
    u = (体 or {}).get("usage") or {}
    细 = u.get("completion_tokens_details") or {}
    想 = 细.get("reasoning_tokens", u.get("reasoning_tokens"))
    if isinstance(想, (int, float)):
        return int(想)
    if "googleapis.com" in (地址 or "").lower():
        差 = _数(u.get("total_tokens")) - _数(u.get("prompt_tokens")) - _数(u.get("completion_tokens"))
        return 差 if 差 > 0 else None
    return None


def _数(x) -> int:
    return int(x) if isinstance(x, (int, float)) else 0


_文件头 = ((b"\x89PNG\r\n\x1a\n", "image/png"), (b"\xff\xd8\xff", "image/jpeg"),
        (b"GIF8", "image/gif"), (b"RIFF", "image/webp"))


def _猜格式(图: bytes) -> str:
    for 头, 格式 in _文件头:
        if 图.startswith(头):
            return 格式
    return "application/octet-stream"


def _认图格式(图: bytes) -> str:
    格式 = _猜格式(图)
    if 格式 == "application/octet-stream":
        raise 底座错误(f"这不是认得出的图片(只认 PNG / JPEG / GIF / WebP),"
                    f"头几个字节长这样:{图[:8]!r}")
    return 格式


def _取图(体: dict, 超时: int) -> tuple[bytes, str]:
    图, 格式 = _扒图字节(体, 超时)
    if not isinstance(图, bytes) or _猜格式(图) == "application/octet-stream":
        raise 答非所问(f"生图回来的不是认得出的图片(只认 PNG / JPEG / GIF / WebP),"
                    f"共 {len(图 or b'')} 字节,头几个字节长这样:{(图 or b'')[:16]!r}")
    return 图, 格式


def _扒图字节(体: dict, 超时: int) -> tuple[bytes, str]:
    if not isinstance(体, dict):
        raise 底座错误(f"回来的不是一个对象:{str(体)[:200]}")

    if 体.get("success") is False:
        原话们 = []
        for 错 in (体.get("errors") or []):
            if isinstance(错, dict):
                原话们.append(str(错.get("message") or 错))
            else:
                原话们.append(str(错))
        原话 = "; ".join(x for x in 原话们 if x) or json.dumps(体, ensure_ascii=False)[:200]
        raise 底座错误(f"Cloudflare Workers AI 生图失败:{原话}")
    CF图 = ((体.get("result") or {}).get("image")
           if isinstance(体.get("result"), dict) else None) or 体.get("image")
    if CF图:
        图 = base64.b64decode(CF图)
        return 图, _猜格式(图)

    for 块 in (体.get("candidates") or []):
        for 片 in ((块.get("content") or {}).get("parts") or []):
            源 = 片.get("inlineData") or 片.get("inline_data") or {}
            if 源.get("data"):
                图 = base64.b64decode(源["data"])
                return 图, (源.get("mimeType") or 源.get("mime_type") or _猜格式(图))

    for 块 in (体.get("choices") or []):
        for 片 in (((块.get("message") or {}).get("images")) or []):
            网址 = str((片.get("image_url") or {}).get("url") or "")
            if 网址.startswith("data:"):
                头, _, 码 = 网址.partition(",")
                图 = base64.b64decode(码)
                报的 = 头[5:].split(";")[0]
                return 图, (报的 if 报的.startswith("image/") else _猜格式(图))
            if 网址:
                with urllib.request.urlopen(网址, timeout=超时) as 回:
                    图 = 回.read()
                return 图, _猜格式(图)
    话 = "".join(str((块.get("message") or {}).get("content") or "")
                for 块 in (体.get("choices") or []))
    if 话.strip():
        raise 底座错误(f"这条走的是聊天口出图,这一次它只回了文字、没出图:{话.strip()[:200]}")

    for 片 in (体.get("images") or []):
        if isinstance(片, dict) and 片.get("url"):
            with urllib.request.urlopen(片["url"], timeout=超时) as 回:
                图 = 回.read()
            return 图, _猜格式(图)

    条 = (体.get("data") or [{}])[0]
    if 条.get("b64_json"):
        图 = base64.b64decode(条["b64_json"])
        return 图, _猜格式(图)
    if 条.get("url"):
        with urllib.request.urlopen(条["url"], timeout=超时) as 回:
            图 = 回.read()
        return 图, _猜格式(图)
    raise 底座错误(f"回来的东西里既没有图片也没有图片网址:{json.dumps(体, ensure_ascii=False)[:200]}")


_比例们 = ("1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9")


def _拆尺寸(尺寸: str) -> tuple[int, int]:
    宽高 = re.fullmatch(r"\s*(\d+)\s*[xX×]\s*(\d+)\s*", 尺寸 or "")
    if not 宽高:
        raise 底座错误(f"尺寸得写成「宽x高」这样(比如 1024x1024),拿到的是「{尺寸}」")
    宽, 高 = int(宽高.group(1)), int(宽高.group(2))
    if not 宽 or not 高:
        raise 底座错误(f"尺寸的宽和高都得大于 0,拿到的是「{尺寸}」")
    return 宽, 高


def _算比例(尺寸: str) -> str:
    宽, 高 = _拆尺寸(尺寸)
    要 = math.log(宽 / 高)
    return min(_比例们,
               key=lambda b: abs(要 - math.log(int(b.split(":")[0]) / int(b.split(":")[1]))))


def _要不透明(模型: str) -> bool:
    return str(模型).strip().lower().startswith("gpt-image")


def _拼多段表单(模型: str, 提示词: str, 尺寸: str, 参考图: list) -> tuple[bytes, str]:
    图们 = [(图, _认图格式(图)) for 图 in 参考图]
    原料 = [str(模型).encode("utf-8"), str(提示词).encode("utf-8"), str(尺寸).encode("utf-8")]
    原料.extend(图 for 图, _ in 图们)
    while True:
        界 = "----ai-base-" + secrets.token_hex(18)
        界字节 = 界.encode("ascii")
        if all(界字节 not in 一份 for 一份 in 原料):
            break

    块们: list[bytes] = []

    def 加文字(名字: str, 值: str):
        块们.extend((
            b"--" + 界字节 + b"\r\n",
            f'Content-Disposition: form-data; name="{名字}"\r\n\r\n'.encode("ascii"),
            str(值).encode("utf-8"), b"\r\n",
        ))

    加文字("model", 模型)
    加文字("prompt", 提示词)
    加文字("size", 尺寸)
    if _要不透明(模型):
        加文字("background", "opaque")
    图名 = "image" if len(图们) == 1 else "image[]"
    后缀 = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp"}
    for 序, (图, 格式) in enumerate(图们, 1):
        块们.extend((
            b"--" + 界字节 + b"\r\n",
            (f'Content-Disposition: form-data; name="{图名}"; filename="image-{序}.'
             f'{后缀[格式]}"\r\nContent-Type: {格式}\r\n\r\n').encode("ascii"),
            bytes(图), b"\r\n",
        ))
    块们.append(b"--" + 界字节 + b"--\r\n")
    return b"".join(块们), f"multipart/form-data; boundary={界}"


路子_GEMINI = "gemini原生"
路子_OPENAI = "openai生图"
路子_聊天口 = "聊天口改写"
路子_硅基 = "硅基流动生图"
路子_CF = "cloudflare生图"


def 生图路子(地址: str) -> str | None:
    地址 = (地址 or "").strip()
    if not 地址:
        return None
    拆 = urllib.parse.urlsplit(地址)
    if (拆.hostname or "").lower() == "api.cloudflare.com":
        return 路子_CF if "/ai/run" in 拆.path.lower() else None
    if "{模型}" in 地址:
        return 路子_GEMINI
    if 地址.rstrip("/").endswith("/chat/completions"):
        return 路子_聊天口
    if "siliconflow" in 拆.netloc.lower():
        return 路子_硅基
    return 路子_OPENAI


def 吃参考图吗(地址: str) -> bool | None:
    路 = 生图路子(地址)
    return None if 路 is None else 路 not in (路子_聊天口, 路子_硅基, 路子_CF)


def _拼生图请求(地址: str, 模型: str, 提示词: str, 尺寸: str,
             参考图=()) -> tuple[str, dict | bytes, str]:
    参考图 = _几张(参考图)
    路 = 生图路子(地址)
    if 路 is None:
        raise 底座错误(f"这不是生图地址:{地址}")
    if 路 == 路子_GEMINI:
        return 地址.replace("{模型}", 模型), {
            "contents": [{"parts": [{"text": 提示词}] + [_塞图(图) for 图 in 参考图]}],
            "generationConfig": {"imageConfig": {"aspectRatio": _算比例(尺寸)}},
        }, "application/json"
    if 路 == 路子_聊天口:
        if 参考图:
            raise 底座错误(
                f"这条生图路子还没开图生图:「{地址}」是聊天口出图那套,递进去的参考图它到底"
                f"看没看见,本仓一次都没实测过 —— 不实测就发出去,等于重演 images/generations "
                f"那条「收下了不看还回 200」的病。要图生图,在设置面板上把这条功能拨给地址里带 "
                f"{{模型}} 占位符的那家(Gemini 原生 generateContent 那种口,比如「CPA 反代 · Gemini 生图 / gemini-3.1-flash-image」);只想按文字画,就别递参考图。")
        宽, 高 = _拆尺寸(尺寸)
        return 地址, {"model": 模型, "messages": [
            {"role": "user", "content": f"{提示词}\n\n(图片尺寸:{宽}x{高})"}]}, "application/json"

    if 路 == 路子_CF:
        if 参考图:
            raise 底座错误(
                f"Cloudflare Workers AI 这条生图接口不吃参考图:「{地址}」的官方请求体只有 prompt"
                f"和可选的 steps。只想按文字画,就别递参考图。")
        return 地址.rstrip("/") + "/" + 模型.lstrip("/"), {
            "prompt": 提示词}, "application/json"

    if 路 == 路子_硅基:
        if 参考图:
            raise 底座错误(
                f"这条生图路子还没开图生图:「{地址}」是硅基流动那家,它的参考图只有部分模型认,"
                f"本仓一次都没实测过。要图生图,在设置面板上把这条功能拨给地址里带 "
                f"{{模型}} 占位符的那家;只想按文字画,就别递参考图。")
        宽, 高 = _拆尺寸(尺寸)
        return 地址, {"model": 模型, "prompt": 提示词,
                    "image_size": f"{宽}x{高}", "batch_size": 1}, "application/json"

    if 参考图:
        净地址 = 地址.rstrip("/")
        if not 净地址.endswith("/images/generations"):
            raise 底座错误(f"OpenAI 图生图只认以 /images/generations 结尾的供应商地址,"
                        f"拿到的是「{地址}」")
        表单, 内容类型 = _拼多段表单(模型, 提示词, 尺寸, 参考图)
        return 净地址[:-len("/generations")] + "/edits", 表单, 内容类型
    载荷 = {"model": 模型, "prompt": 提示词, "n": 1, "size": 尺寸}
    if _要不透明(模型):
        载荷["background"] = "opaque"
    return 地址, 载荷, "application/json"


def _几张(参考图) -> list:
    if isinstance(参考图, (bytes, bytearray)):
        return [参考图]
    return list(参考图 or ())


def _扒图(图: bytes) -> tuple[str, str]:
    格式 = _认图格式(图)
    return 格式, base64.b64encode(图).decode("ascii")


def _塞图问(图: bytes) -> dict:
    格式, 码 = _扒图(图)
    return {"type": "image_url", "image_url": {"url": f"data:{格式};base64,{码}"}}


def _拼话(user: str, 参考图: list):
    if not 参考图:
        return user
    return [{"type": "text", "text": user}] + [_塞图问(图) for 图 in 参考图]


def _塞图(图: bytes) -> dict:
    格式, 码 = _扒图(图)
    return {"inlineData": {"mimeType": 格式, "data": 码}}


def _发生图请求(地址: str, 密钥: str, 载荷: dict | bytes,
            内容类型: str, 超时: int) -> tuple[bytes, str]:
    if isinstance(载荷, bytes):
        体 = _打多段(地址, 密钥, 载荷, 内容类型, 超时)
    else:
        体 = _打(地址, 密钥, 载荷, 超时)
    return _取图(体, 超时)


_围栏 = re.compile(r"```[^\n]*\n(.*?)\n?```", re.DOTALL)


def _剥围栏(文: str) -> str:
    命中 = _围栏.search(文)
    return 命中.group(1).strip() if 命中 else 文


def _校文(文) -> str:
    if not isinstance(文, str) or not 文.strip():
        raise 答非所问(f"模型这次没回正文(回来的是 {文!r})")
    return 文


def _校JSON(文: str) -> str:
    干净 = _剥围栏(文)
    try:
        json.loads(干净)
    except ValueError as e:
        raise 答非所问(f"要的是 JSON,回来的不是({e});原文前 200 字:{干净[:200]}")
    return 干净


def _拼命令行话(user: str, 参考图: list) -> str:
    内容 = [{"type": "text", "text": user}]
    for 图 in 参考图:
        格式, 码 = _扒图(图)
        内容.append({"type": "image", "source": {"type": "base64", "media_type": 格式, "data": 码}})
    return json.dumps({"type": "user", "message": {"role": "user", "content": 内容}}) + "\n"


def _取信封(输出: str):
    try:
        体 = json.loads(输出)
        if isinstance(体, dict):
            return 体
    except ValueError:
        pass
    for 行 in reversed((输出 or "").splitlines()):
        try:
            事 = json.loads(行)
        except ValueError:
            continue
        if isinstance(事, dict) and 事.get("type") == "result":
            return 事
    return None


def _发命令行请求(可执行: str, 模型: str, system: str, user: str,
                要JSON: bool, 超时: int, 用力: str = 关档, 参考图=()) -> str:
    劲, 关思考 = _命令行用力(用力)
    if 要JSON:
        system = (system or "") + "\n\n只输出一个 JSON 对象,不要 Markdown 围栏,不要任何解释文字。"
    真可执行 = _找命令(可执行) or 可执行
    命令 = [
        真可执行, "-p",
        "--model", 模型,
        "--system-prompt", system,
        "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--tools", "",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--strict-mcp-config",
        "--effort", 劲,
    ]
    环境 = {
        **os.environ,
        "PROGRESS_VIEW_OFF": "1",
    }
    if 关思考:
        环境["CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING"] = "1"
        环境["MAX_THINKING_TOKENS"] = "0"
    else:
        环境.pop("CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING", None)
        环境.pop("MAX_THINKING_TOKENS", None)
    完 = subprocess.run(命令, capture_output=True, text=True, timeout=超时,
                       env=环境, input=_拼命令行话(user, 参考图 or ()))
    if 完.returncode != 0:
        细 = (完.stderr or "").strip()
        if not 细:
            细 = str((_取信封(完.stdout) or {}).get("result") or 完.stdout or "")
        话 = f"{可执行} -p 退出码 {完.returncode}:{细.strip()[:500]}"
        码 = re.match(r"API Error: (\d{3})\b", 细.strip())
        if 码:
            raise 上游报码(话, int(码.group(1)))
        raise 底座错误(话)
    信封 = _取信封(完.stdout)
    文 = 信封.get("result") if isinstance(信封, dict) else None
    if isinstance(信封, dict) and 信封.get("stop_reason") == "max_tokens":
        raise 回话截断(_截断话("输出上限"))
    if not isinstance(文, str):
        raise 底座错误(f"{可执行} 的信封里没找到文本:{(完.stdout or '')[:200]}")
    return 文


def _网页用力(用力: str, 地址: str = "", 档们=None):
    用力 = (用力 or 关档).strip() or 关档
    if 档们 is not None and not [x for x in 档们 if x and x != 关档]:
        return None, None
    if 用力 != 关档:
        return "reasoning_effort", 用力
    if _认thinking(地址):
        return "thinking", {"type": "disabled"}
    return "reasoning_effort", _最低档(档们)


def _关法说明(类型: str, 地址: str = "", 档们=None) -> str:
    if 类型 == "命令行":
        return "真关掉"
    键, 值 = _网页用力(关档, 地址, 档们)
    if 键 is None:
        return "没这一格"
    return "真关掉" if 键 == "thinking" else f"最低档 {值}"


def _最低档(档们) -> str:
    净 = [x for x in (档们 or ()) if x and x != 关档]
    return 净[0] if 净 else _默认强度档["网页接口"][0]


def _命令行用力(用力: str):
    用力 = (用力 or 关档).strip() or 关档
    if 用力 == 关档:
        return "high", True
    return 用力, False

_种类们 = ("文本", "生图")
_该用 = {"文本": "问()", "生图": "画图()"}


def _换得了吗(e: Exception) -> bool:
    return _值得重试(getattr(e, "原因", None) or e)


def 是Anthropic(供) -> bool:
    if 供 is None or (供["类型"] or "") != "命令行":
        return False
    程序 = re.split(r"[\\/]", ((供["地址"] or "").split() or [""])[0])[-1].lower()
    return os.path.splitext(程序)[0] == "claude"


def _族头(conn, 名: str) -> str:
    行 = conn.execute("SELECT 父功能 FROM 功能 WHERE 功能名=?", (名,)).fetchone()
    return ((行["父功能"] if 行 is not None else "") or "") or 名


def _带机密标(conn, 名: str) -> bool:
    行 = conn.execute("SELECT 客户机密 FROM 功能 WHERE 功能名=?", (_族头(conn, 名),)).fetchone()
    return bool(行 is not None and 行["客户机密"])


def _机密话(功能名: str, 供应商: str, 模型: str = "") -> str:
    拨 = f"{供应商}/{模型}" if 模型 else 供应商
    return (f"「{功能名}」处理敏感内容,只许用 Claude(本机 claude 命令行那一家),现在拨的是「{拨}」。"
            f"去面板把这一族换成那一家的模型")


def _守机密(conn, 名: str, 供应商: str, 模型: str = "", *, 族: str = "") -> None:
    if not _带机密标(conn, 族 or 名):
        return
    供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (供应商,)).fetchone()
    if not 是Anthropic(供):
        raise 机密拒拨(_机密话(族 or _族头(conn, 名), 供应商, 模型))


def 机密违规(库: str | None = None, conn=None) -> list[dict]:
    自己连 = conn is None
    conn = conn or 连库(库)
    try:
        出 = []
        for r in conn.execute(f"SELECT * FROM 功能 ORDER BY {_族内序}"):
            if not _带机密标(conn, r["功能名"]):
                continue
            供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (r["主用供应商"],)).fetchone()
            if not 是Anthropic(供):
                出.append({"功能名": r["功能名"], "族": _族头(conn, r["功能名"]),
                           "供应商": r["主用供应商"] or "", "模型": r["主用模型"] or ""})
        return 出
    finally:
        if 自己连:
            conn.close()


def 设机密(功能名: str, 是: bool, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        行 = conn.execute("SELECT * FROM 功能 WHERE 功能名=?", (功能名,)).fetchone()
        if 行 is None:
            raise 功能未登记(f"功能表里没有「{功能名}」")
        if 行["父功能"] or "":
            raise 底座错误(f"「{功能名}」是备选行,标只打在头行「{行['父功能']}」上,备选跟着头行走")
        if bool(行["客户机密"]) == bool(是):
            return False
        if 是:
            conn.execute("UPDATE 功能 SET 客户机密=1 WHERE 功能名=?", (功能名,))
        else:
            笔 = f"【{time.strftime('%Y-%m-%d %H:%M')} 命令行去掉了敏感内容标】"
            conn.execute("UPDATE 功能 SET 客户机密=0, 说明=TRIM(IFNULL(说明,'')||' '||?) "
                         "WHERE 功能名=?", (笔, 功能名))
        return True
    finally:
        conn.close()


def _降级候选(conn, 主行, 种类: str) -> list:
    return list(conn.execute(
        "SELECT * FROM 功能 WHERE 父功能=? AND 启用=1 AND IFNULL(种类,'文本')=?"
        f" ORDER BY {_族内序}", (主行["功能名"], 种类)))


_历史角色 = ("user", "assistant")


def _理历史(历史) -> list:
    if not 历史:
        return []
    if isinstance(历史, dict):
        历史 = [历史]
    出 = []
    for i, 条 in enumerate(历史):
        if not isinstance(条, dict):
            raise 底座错误(f"历史第 {i + 1} 条不是一个字典,给的是 {type(条).__name__};"
                        f"每条要写成 {{'role': 'user' 或 'assistant', 'content': '说了什么'}}")
        角 = str(条.get("role") or "").strip()
        if 角 not in _历史角色:
            raise 底座错误(f"历史第 {i + 1} 条的 role 是「{角}」,只认 user 或 assistant"
                        f"(总指令走 问() 的 system= 那个参数给,别塞进历史里)")
        文 = 条.get("content")
        if not isinstance(文, str) or not 文.strip():
            raise 底座错误(f"历史第 {i + 1} 条的 content 是空的 —— 空消息有的家直接回 400")
        出.append({"role": 角, "content": 文})
    return 出


_摊平头 = "【前面已经聊过的】"
_摊平尾 = "【以上是前面聊过的,下面才是我这一次要说的】"


def _摊平历史(历史: list, user: str) -> str:
    if not 历史:
        return user
    行 = [_摊平头]
    for 条 in 历史:
        谁 = "我" if 条["role"] == "user" else "你"
        行.append(f"{谁}:{条['content']}")
    行.append(_摊平尾)
    行.append(user)
    return "\n\n".join(行)


def _轮着试(conn, 主行, 主供, 种类: str, 跑一趟, 换备选: bool = True,
          回执: dict | None = None, 客户机密: bool = False):
    候 = [(主行, 主供)]
    for r in (_降级候选(conn, 主行, 种类) if 换备选 else ()):
        供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (r["主用供应商"],)).fetchone()
        if 供 is not None:
            候.append((r, 供))
    if 客户机密 or _带机密标(conn, 主行["功能名"]):
        能拨 = [(r, 供) for r, 供 in 候 if 是Anthropic(供)]
        if not 能拨:
            raise 机密拒拨(_机密话(主行["功能名"], 主行["主用供应商"] or "", 主行["主用模型"] or ""))
        候 = 能拨
    末 = None
    for i, (行, 供) in enumerate(候):
        try:
            理由 = _需求理由(conn, 行, 主行["需求种类"])
            if 理由:
                raise 底座错误(理由)
            _要同意(供)
            出 = 跑一趟(行, 供)
            if 回执 is not None:
                回执.update(_回执(行, 主行, [r["功能名"] for r, _ in 候[:i + 1]], 末))
            return 出
        except Exception as e:
            末 = 末 or e
            if i == len(候) - 1:
                raise 末
            if i == 0 and not (_换得了吗(e) or isinstance(e, 撞上限)):
                raise
    raise 末


def _回执(行, 主行, 试过: list, 首选错) -> dict:
    return {"功能名": 主行["功能名"], "实际那一行": 行["功能名"],
            "供应商": 行["主用供应商"], "模型": 行["主用模型"],
            "推理强度": 行["用力"] or 关档,
            "换过备选": 行["功能名"] != 主行["功能名"],
            "试过": 试过, "首选错误": str(首选错)[:300] if 首选错 else ""}


def _查路(conn, 功能名: str, 要的种类: str, 客户机密: bool = False):
    行 = conn.execute("SELECT * FROM 功能 WHERE 功能名=?", (功能名,)).fetchone()
    if 行 is None:
        raise 功能未登记(f"功能表里没有「{功能名}」,先在面板上加一行")
    理由 = _需求理由(conn, 行)
    if 理由:
        raise 缺配置(f"「{功能名}」{理由}")
    这 = 行["种类"] or "文本"
    if 这 != 要的种类:
        raise 底座错误(f"「{功能名}」在表里记的是「{这}」功能,该用 {_该用[这]} 调,"
                    f"不是 {_该用[要的种类]}")
    供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (行["主用供应商"],)).fetchone()
    if 供 is None:
        raise 缺配置(f"功能「{功能名}」指向的供应商「{行['主用供应商']}」不在供应商表里")
    if (客户机密 or _带机密标(conn, 功能名)) and not 是Anthropic(供):
        return 行, 供
    _要同意(供)
    return 行, 供


def _本机地址(地址: str) -> bool:
    return any(x in (地址 or "") for x in ("127.0.0.1", "localhost", "[::1]"))


def _要同意(供) -> None:
    if not 供["吃订阅"] or (供["已同意"] or "").strip():
        return
    猜的 = (f"\n这一家地址指向本机:加的时候底座会按这一点猜它吃订阅。CPA 这类拿订阅额度换接口的本机反代就是吃订阅,照上面点开启;"
           f"只有你自己装的本机模型(不登录任何账号)才在那张卡上把「这一家烧的是订阅额度」的勾去掉。"
           if 供["类型"] == "网页接口" and _本机地址(供["地址"]) else "")
    raise 缺配置(
        f"「{供['名']}」这一家还没开启,所以这次不发。\n"
        f"它烧的是你自己账号里买过的订阅额度,有被限流甚至封号的风险,装完默认是关着的。\n"
        f"要用它:打开「AI接入底座」设置面板,在「模型供应商」里找到「{供['名']}」那张卡,"
        f"点那颗「我知道有账号风险,开启」。\n"
        f"从源码跑也可以:python3 ai.py 开启 \"{供['名']}\"(面板是 python3 panel.py){猜的}")


def _要密钥(供):
    if "{account_id}" in (供["地址"] or ""):
        raise 缺配置("地址里的账户 ID 还没填")
    if not (供["密钥"] or "").strip():
        raise 缺配置(f"供应商「{供['名']}」还没填密钥:打开「AI接入底座」设置面板,在「模型供应商」里找到"
                     f"「{供['名']}」那张卡填上 key(从源码跑也可以:python3 ai.py 设密钥 {供['名']} <key>)")


def _限速(conn, 谁: str) -> None:
    行 = conn.execute(
        "SELECT IFNULL(最小间隔秒,0) AS 隔, IFNULL(每小时上限,0) AS 顶 FROM 供应商 WHERE 名=?",
        (谁,)).fetchone()
    if not 行:
        return
    隔, 顶 = float(行["隔"] or 0), int(行["顶"] or 0)
    if 隔 <= 0 and 顶 <= 0:
        return

    conn.execute("BEGIN IMMEDIATE")
    try:
        现 = time.time()
        conn.execute("DELETE FROM 发号 WHERE 谁=? AND 时刻<?", (谁, 现 - 3600))

        if 顶 > 0:
            近 = conn.execute("SELECT COUNT(*) AS c FROM 发号 WHERE 谁=?", (谁,)).fetchone()["c"]
            if 近 >= 顶:
                conn.execute("ROLLBACK")
                raise 撞上限(
                    f"「{谁}」这一小时已经发了 {近} 次,撞上你设的上限 {顶} 次/小时,这次不发。\n"
                    f"这道闸是防着把订阅额度当 API 刷 —— 那是最容易招风控的用法。\n"
                    f"确实要放宽:在「AI接入底座」设置面板「模型供应商」里那张卡的「调用频率上限」点「改」"
                    f"(从源码跑也可以:python3 ai.py 限速 \"{谁}\" <最少隔几秒> <每小时最多几次>)")

        if 隔 > 0:
            末 = conn.execute("SELECT MAX(时刻) AS t FROM 发号 WHERE 谁=?", (谁,)).fetchone()["t"]
            if 末:
                该等 = 隔 - (time.time() - float(末))
                if 该等 > 0:
                    time.sleep(该等)

        conn.execute("INSERT INTO 发号(谁,时刻) VALUES(?,?)", (谁, time.time()))
        conn.execute("COMMIT")
    except 底座错误:
        raise
    except Exception:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise


def 设限速(供应商: str, 最小间隔秒: float, 每小时上限: int, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        改 = conn.execute("UPDATE 供应商 SET 最小间隔秒=?, 每小时上限=? WHERE 名=?",
                         (float(最小间隔秒), int(每小时上限), 供应商)).rowcount
        conn.commit()
        return 改 > 0
    finally:
        conn.close()


def 设吃订阅(供应商: str, 吃: bool, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        if 吃:
            改 = conn.execute("UPDATE 供应商 SET 吃订阅=1 WHERE 名=?", (供应商,)).rowcount
        else:
            改 = conn.execute("UPDATE 供应商 SET 吃订阅=0, 已同意=NULL WHERE 名=?",
                             (供应商,)).rowcount
        conn.commit()
        return 改 > 0
    finally:
        conn.close()


def 设同意(供应商: str, 开: bool, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        改 = conn.execute(
            "UPDATE 供应商 SET 已同意=? WHERE 名=?",
            (time.strftime("%Y-%m-%d %H:%M:%S") if 开 else None, 供应商)).rowcount
        conn.commit()
        return 改 > 0
    finally:
        conn.close()


def 开启全部(库: str | None = None) -> int:
    conn = 连库(库)
    try:
        改 = conn.execute(
            "UPDATE 供应商 SET 已同意=? WHERE 吃订阅=1 AND IFNULL(已同意,'')=''",
            (time.strftime("%Y-%m-%d %H:%M:%S"),)).rowcount
        conn.commit()
        return 改
    finally:
        conn.close()


def _设供应商一格(供应商: str, 列: str, 值, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        改 = conn.execute(f"UPDATE 供应商 SET {列}=? WHERE 名=?", (值, 供应商)).rowcount
        conn.commit()
        return 改 > 0
    finally:
        conn.close()


def 设注册页(供应商: str, 网址: str, 库: str | None = None) -> bool:
    网址 = (网址 or "").strip()
    if 网址 and not 网址.lower().startswith(("http://", "https://")):
        raise 底座错误(f"注册页只收 http:// 或 https:// 开头的网址,给的是「{网址}」")
    return _设供应商一格(供应商, "注册页", 网址 or None, 库)


def 设到期日(供应商: str, 日期: str, 库: str | None = None) -> bool:
    日期 = (日期 or "").strip()
    if 日期:
        try:
            time.strptime(日期, "%Y-%m-%d")
        except ValueError:
            raise 底座错误(f"到期日写成 2026-10-01 这样,给的是「{日期}」")
    return _设供应商一格(供应商, "到期日", 日期 or None, 库)


def 查余额(供应商: str, 库: str | None = None, 超时: int = 15) -> dict:
    conn = 连库(库)
    try:
        供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (供应商,)).fetchone()
        if 供 is None:
            raise 底座错误(f"供应商表里没有「{供应商}」")
        条 = 名册一家(供应商) or {}
        址 = str(条.get("余额接口") or "").strip()
        if not 址:
            页 = str(条.get("用量页") or "").strip()
            raise 底座错误(f"「{供应商}」没有查余额的接口" + (f",去官网看:{页}" if 页 else ""))
        if not (供["密钥"] or "").strip():
            raise 底座错误(f"「{供应商}」还没填密钥,查不了余额")
        请 = urllib.request.Request(址, headers=_头(供["密钥"], 址), method="GET")
        try:
            with urllib.request.urlopen(请, timeout=超时) as 回:
                体 = json.loads(回.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise 底座错误(f"查余额没成:HTTP {e.code} {_抹密钥(conn, _报错体(e))[:200]}")
        except (urllib.error.URLError, OSError, ValueError) as e:
            raise 底座错误(f"查余额没成:{type(e).__name__}: {e}")
        话 = _余额话(体)
        _记余额(conn, 供应商, 话)
        return {"余额": 话, "于": time.strftime("%Y-%m-%d %H:%M:%S")}
    finally:
        conn.close()


def _余额话(体) -> str:
    信 = (体 or {}).get("balance_infos") if isinstance(体, dict) else None
    if not isinstance(信, list) or not 信:
        raise 底座错误(f"查余额的回包认不出来:{json.dumps(体, ensure_ascii=False)[:200]}")
    段 = []
    for x in 信:
        总, 赠 = str(x.get("total_balance") or "").strip(), str(x.get("granted_balance") or "").strip()
        if not 总:
            raise 底座错误(f"查余额的回包缺 total_balance:{json.dumps(x, ensure_ascii=False)[:200]}")
        段.append(f"{x.get('currency') or ''} {总}".strip()
                  + (f"(其中赠送 {赠})" if 赠 and 赠 not in ("0", "0.00") else ""))
    话 = "余额 " + ";".join(段)
    return 话 if 体.get("is_available", True) else "⚠ 余额不够调用 · " + 话


def 设只收前缀(供应商: str, 前缀们: str, 库: str | None = None) -> bool:
    清 = ",".join(x.strip() for x in re.split(r"[,，]", 前缀们 or "") if x.strip())
    return _设供应商一格(供应商, "只收前缀", 清 or None, 库)


def 设免费(供应商: str, 是: bool, 库: str | None = None) -> bool:
    return _设供应商一格(供应商, "免费", 1 if 是 else 0, 库)


def 设强度档(供应商: str, 档们: str, 库: str | None = None) -> bool:
    清 = ",".join(x.strip() for x in re.split(r"[,，]", 档们 or "") if x.strip())
    return _设供应商一格(供应商, "强度档", 清 or None, 库)


def _值得重试(e: Exception) -> bool:
    if isinstance(e, 答非所问):
        return True
    if isinstance(e, urllib.error.HTTPError):
        return e.code == 429 or e.code >= 500
    if isinstance(e, 上游报码):
        return e.码 == 429 or e.码 >= 500
    if isinstance(e, subprocess.TimeoutExpired):
        return True
    return isinstance(e, OSError)


_强度报错词 = ("reasoning", "thinking", "valid levels")


def _怪那格强度(e: Exception, 键: str | None) -> bool:
    if not 键 or not isinstance(e, urllib.error.HTTPError) or e.code != 400:
        return False
    话 = _报错体(e).lower()
    return (键 or "").lower() in 话 or any(w in 话 for w in _强度报错词)


def _报错体(e) -> str:
    if not hasattr(e, "_体"):
        try:
            e._体 = e.read().decode("utf-8", "replace")
        except Exception:
            e._体 = ""
        e.read = lambda *a, **kw: e._体.encode("utf-8")
    return e._体


def _超时怪谁(e: Exception, 用力: str | None) -> str:
    if not isinstance(e, subprocess.TimeoutExpired):
        return ""
    档 = (用力 or 关档).strip() or 关档
    if 档 == 关档:
        return ""
    return (f"这一行的推理强度挑的是「{档}」,模型会先想很久再动笔,大活很容易超过 "
            f"{int(e.timeout)} 秒 —— 在面板上把这一格改成「{关档}」再试一次。原始报错:")


_报错体留头, _报错体留尾 = 900, 600


def _跑(conn, 功能名: str, 谁: str, 模型: str, 发一次, 重试: int,
       收: dict | None = None, 用力: str | None = None):
    起 = None
    末错: Exception | None = None
    for 第 in range(重试 + 1):
        try:
            _限速(conn, 谁)
        except Exception:
            if 末错 is None:
                raise
            break
        if 起 is None:
            起 = time.time()
        if 收 is not None:
            收.clear()
        try:
            得 = 发一次()
        except Exception as e:
            细 = ""
            if isinstance(e, urllib.error.HTTPError):
                体 = _报错体(e)
                if len(体) > _报错体留头 + _报错体留尾:
                    体 = (f"{体[:_报错体留头]} …(中间略 {len(体) - _报错体留头 - _报错体留尾} 字)… "
                         f"{体[-_报错体留尾:]}")
                细 = ": " + 体
            if isinstance(e, urllib.error.HTTPError):
                类 = 底座错误
            elif isinstance(e, FileNotFoundError):
                类 = 缺配置
            elif isinstance(e, (urllib.error.URLError, ConnectionError, TimeoutError)):
                类 = 连不上
            elif isinstance(e, 回话截断):
                类 = 回话截断
            else:
                类 = 底座错误
            几次 = f"(同一行共试了 {第 + 1} 次,这是最后一次的报错)" if 第 else ""
            末错 = 类(f"{_超时怪谁(e, 用力)}{type(e).__name__}: {e}{细}{几次}")
            末错.原因 = e
            if not _值得重试(e):
                break
            if 第 < 重试 and 429 in (getattr(e, "code", None), getattr(e, "码", None)):
                time.sleep(2)
            continue
        _记日志(conn, 功能名, 谁, 模型, True, 起, "", (收 or {}).get("想了"), 用力)
        if (收 or {}).get("剩余"):
            _记余额(conn, 谁, f"{模型} {收['剩余']}")
        return 得
    _记日志(conn, 功能名, 谁, 模型, False, 起, str(末错), None, 用力)
    raise 末错


def _认thinking(地址: str) -> bool:
    return "deepseek.com" in (地址 or "").lower()


def 问(功能名: str, system: str, user: str, *, 要JSON: bool = False, 参考图=None,
      历史=None, 超时: int = 180, 重试: int = 1, 换备选: bool = True,
      回执: dict | None = None, 客户机密: bool = False, 库: str | None = None) -> str:
    conn = 连库(库)
    收: dict = {}
    参考图 = _几张(参考图)
    try:
        主行, 主供 = _查路(conn, 功能名, "文本", 客户机密)
        往来 = _理历史(历史)
        return _轮着试(conn, 主行, 主供, "文本",
                     lambda 行, 供: _问一趟(conn, 行, 供, system, user,
                                        要JSON, 参考图, 往来, 超时, 重试, 收),
                     换备选=换备选, 回执=回执, 客户机密=客户机密)
    finally:
        conn.close()


def _问一趟(conn, 行, 供, system, user, 要JSON, 参考图, 往来, 超时, 重试, 收) -> str:
    功能名 = 行["功能名"]
    if 供["类型"] == "网页接口":
        _要密钥(供)
        载荷 = {
            "model": 行["主用模型"],
            "messages": ([{"role": "system", "content": system}] + 往来
                         + [{"role": "user", "content": _拼话(user, 参考图)}]),
            "temperature": 1.0,
            "max_tokens": 8192,
            "stream": False,
        }
        键, 值 = _网页用力(行["用力"], 供["地址"],
                       模型档位(供["类型"], 供["地址"] or "", 行["主用模型"],
                              _笔记行(conn, 供["名"], 行["主用模型"]),
                              供["强度档"] or "")["档们"])
        if 键:
            载荷[键] = 值
        if 要JSON:
            载荷["response_format"] = {"type": "json_object"}

        自己挑的 = (行["用力"] or 关档).strip() != 关档

        def 发一次():
            try:
                return _发网页请求(供["地址"], 供["密钥"], 载荷, 超时, 收)
            except urllib.error.HTTPError as e:
                if 自己挑的 or not _怪那格强度(e, 键):
                    raise
                载荷.pop(键, None)
                _限速(conn, 供["名"])
                return _发网页请求(供["地址"], 供["密钥"], 载荷, 超时, 收)
    elif 供["类型"] == "命令行":
        问话 = _摊平历史(往来, user)
        def 发一次():
            return _发命令行请求(供["地址"] or "claude", 行["主用模型"],
                              system, 问话, 要JSON, 超时, 行["用力"] or 关档, 参考图=参考图)
    else:
        raise 底座错误(f"供应商「{供['名']}」的类型「{供['类型']}」不认识,"
                    f"只能是 网页接口 或 命令行")
    try:
        return _跑(conn, 功能名, 供["名"], 行["主用模型"],
                  (lambda: _校JSON(_校文(发一次()))) if 要JSON else (lambda: _校文(发一次())),
                  重试, 收, 行["用力"] or 关档)
    except 底座错误 as e:
        if 参考图 and "image" in str(e).lower() and not _换得了吗(e):
            raise 底座错误(
                f"{e}\n↑ 这个模型不吃图。在设置面板上把功能「{功能名}」拨给一个吃图的 —— "
                f"模型表里名字后头带 👁 的就是测过能看图的。") from e
        raise


def 问JSON(功能名: str, system: str, user: str, **kw) -> dict:
    return json.loads(问(功能名, system, user, 要JSON=True, **kw))


def 画图(功能名: str, 提示词: str, *, 尺寸: str = "1024x1024", 参考图=None,
       超时: int = 180, 重试: int = 0, 换备选: bool = True,
       回执: dict | None = None, 库: str | None = None) -> tuple[bytes, str]:
    conn = 连库(库)
    try:
        主行, 主供 = _查路(conn, 功能名, "生图")
        return _轮着试(conn, 主行, 主供, "生图",
                     lambda 行, 供: _画一趟(conn, 行, 供, 提示词, 尺寸, 参考图, 超时, 重试),
                     换备选=换备选, 回执=回执)
    finally:
        conn.close()


def _画一趟(conn, 行, 供, 提示词, 尺寸, 参考图, 超时, 重试):
    if 供["类型"] != "网页接口":
        raise 底座错误(f"生图只能走网页接口,「{供['名']}」是「{供['类型']}」那种")
    _要密钥(供)
    网址, 载荷, 内容类型 = _拼生图请求(
        供["地址"], 行["主用模型"], 提示词, 尺寸, 参考图 or ())
    return _跑(conn, 行["功能名"], 供["名"], 行["主用模型"],
              lambda: _发生图请求(网址, 供["密钥"], 载荷, 内容类型, 超时), 重试)


def _找命令(可执行: str) -> str | None:
    return shutil.which(可执行) or shutil.which(可执行, path=os.path.expanduser(os.path.join("~", ".local", "bin")))


def 本机可用(类型: str, 地址: str) -> bool:
    if 类型 != "命令行":
        return True
    return bool(_找命令(地址 or "claude"))


_出口探针 = ("https://ipwho.is/?lang=zh-CN", "https://api.ipify.org", "https://ifconfig.me/ip")


def _读出口探针(网址: str, 超时: int) -> tuple[str | None, str, str]:
    请 = urllib.request.Request(网址, headers={"User-Agent": _UA})
    with urllib.request.urlopen(请, timeout=超时) as r:
        文 = r.read().decode("utf-8", "replace").strip()
    地, 运营商 = "", ""
    if 文.startswith("{"):
        d = json.loads(文)
        if d.get("success") is False:
            return (None, "", "")
        候 = str(d.get("ip") or "").strip()
        地 = " · ".join(str(x) for x in (d.get("country"), d.get("region"), d.get("city")) if x)
        运营商 = str((d.get("connection") or {}).get("isp") or d.get("isp") or "")
    else:
        候 = 文
    if 候 and len(候) <= 45:
        return (候, 地, 运营商)
    return (None, "", "")


def 查出口(库: str | None = None, 超时: int = 8) -> dict:
    现在 = None
    地 = ""
    运营商 = ""
    错 = ""
    for 网址 in _出口探针:
        try:
            候, 候地, 候运 = _读出口探针(网址, 超时)
            if 候:
                现在, 地, 运营商 = 候, 候地, 候运
                break
        except Exception as e:
            错 = f"{type(e).__name__}: {e}"

    conn = 连库(库)
    try:
        上次行 = conn.execute("SELECT 地址 FROM 出口 ORDER BY 时刻 DESC LIMIT 1").fetchone()
        上次 = 上次行["地址"] if 上次行 else None
        if 现在:
            if 现在 != 上次:
                conn.execute("INSERT INTO 出口(时刻,地址) VALUES(?,?)",
                             (time.strftime("%Y-%m-%d %H:%M:%S"), 现在))
                conn.commit()
        历史 = [dict(r) for r in conn.execute(
            "SELECT 时刻,地址 FROM 出口 ORDER BY 时刻 DESC LIMIT 5")]
    finally:
        conn.close()

    return {"现在": 现在, "上次": 上次, "地": 地, "运营商": 运营商,
            "变了": bool(现在 and 上次 and 现在 != 上次),
            "历史": 历史, "错": 错 if not 现在 else ""}


def 想过账(conn) -> dict:
    return {f"{r['用了谁']}\n{r['模型']}\n{r['用力']}": {"想了": r["想了"], "时刻": r["时刻"]}
            for r in conn.execute(
                "SELECT 用了谁, 模型, 用力, 想了, 时刻, MAX(rowid) FROM 日志"
                " WHERE 成没成=1 AND 想了 IS NOT NULL AND 用力 IS NOT NULL"
                " GROUP BY 用了谁, 模型, 用力")}


def _拨不动理由(供应商: dict | None) -> str:
    if not 供应商:
        return "库里没有这一家"
    if not 供应商["本机可用"]:
        return "本机没找到这个程序"
    if 供应商["要密钥"] and not 供应商["有密钥"]:
        return "密钥还没填"
    if 供应商["吃订阅"] and not 供应商["已同意"]:
        return "还没点过「我知道有账号风险,开启」"
    return ""


def 读配置(库: str | None = None, 日志条数: int = 10, 日志跳过: int = 0,
        日志报错全文: bool = False, 日志功能名: str = "", 日志只看失败: bool = False) -> dict:
    conn = 连库(库)
    今天 = time.strftime("%Y-%m-%d")
    今天次数 = {r["用了谁"]: r["c"] for r in conn.execute(
        "SELECT 用了谁, COUNT(*) AS c FROM 日志 WHERE 时刻>=? GROUP BY 用了谁", (今天,))}
    近7天 = {}
    for r in conn.execute(
            "SELECT 用了谁, 模型, COUNT(*) AS c, SUM(成没成) AS s FROM 日志 "
            "WHERE 时刻>=? GROUP BY 用了谁, 模型",
            (time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() - 7 * 86400)),)):
        近7天.setdefault(r["用了谁"], {})[r["模型"]] = {"次": r["c"], "成": r["s"] or 0}
    笔 = {}
    for r in conn.execute("SELECT * FROM 模型笔记 ORDER BY 模型"):
        笔.setdefault(r["供应商"], []).append(
            {"模型": r["模型"], "备注": r["备注"] or "", "判断": r["判断"] or "",
             "连通": r["连通"] or "", "测于": r["测于"] or "",
             "测出的话": (r["测出的话"] or "")[:300],
             "藏了": bool(r["藏了"]), "何时": r["何时"] or "",
             "强度档": r["强度档"] or "", "档位来源": r["档位来源"] or "",
             "档位探于": r["档位探于"] or "", "档位指纹": r["档位指纹"] or "",
             "看图": r["看图"] or "", "看图来源": r["看图来源"] or "",
             "测速毫秒": r["测速毫秒"],
             "免费": r["免费"] or "", "免费出处": r["免费出处"] or ""})
    try:
        册 = {str(c["名"]).strip(): c for c in 名册()}
    except 底座错误:
        册 = {}
    供 = []
    for r in conn.execute("SELECT * FROM 供应商 ORDER BY 名"):
        条 = 册.get(r["名"]) or {}
        一家 = {
            "ID": _编号("GS", r["号"]),
            "名": r["名"], "类型": r["类型"], "地址": r["地址"] or "",
            "备注": r["备注"] or "",
            "有密钥": bool((r["密钥"] or "").strip()),
            "要密钥": r["类型"] != "命令行",
            "只收前缀": r["只收前缀"] or "",
            "模型们": [x.strip() for x in (r["模型们"] or "").split(",") if x.strip()],
            "强度档": 强度档们(r["类型"], r["强度档"] or ""),
            "关法": _关法说明(r["类型"], r["地址"] or "",
                          强度档们(r["类型"], r["强度档"] or "")),
            "模型档位": {n["模型"]: dict(模型档位(r["类型"], r["地址"] or "", n["模型"], n,
                                            r["强度档"] or ""),
                                    关法=_关法说明(r["类型"], r["地址"] or "",
                                                模型档位(r["类型"], r["地址"] or "", n["模型"], n,
                                                       r["强度档"] or "")["档们"]))
                      for n in 笔.get(r["名"], [])},
            "本机可用": 本机可用(r["类型"], r["地址"] or ""),
            "近7天": 近7天.get(r["名"], {}),
            "递得进图": _递得进图(r["类型"]),
            "最小间隔秒": float(r["最小间隔秒"] or 0),
            "每小时上限": int(r["每小时上限"] or 0),
            "吃订阅": bool(r["吃订阅"]),
            "免费": bool(r["免费"]),
            "已同意": r["已同意"] or "",
            "注册页": r["注册页"] or "",
            "领key步骤": [str(x) for x in 条.get("领key步骤") or []],
            "今天次数": 今天次数.get(r["名"], 0),
            "余额": r["余额"] or "", "余额于": r["余额于"] or "", "到期日": r["到期日"] or "",
            "查得了余额": bool(str(条.get("余额接口") or "").strip()),
            "用量页": str(条.get("用量页") or ""),
            "模型笔记": 笔.get(r["名"], []),
        }
        一家["拨不动理由"] = _拨不动理由(一家)
        供.append(一家)
    家地址 = {s["名"]: s["地址"] for s in 供}
    家们 = {s["名"]: s for s in 供}
    功 = [{"ID": _编号("GN", r["号"]), "功能名": r["功能名"], "主用供应商": r["主用供应商"] or "",
           "主用模型": r["主用模型"] or "", "种类": r["种类"] or "文本",
           "启用": bool(r["启用"]), "用力": r["用力"] or 关档,
           "说明": r["说明"] or "", "备注": r["备注"] or "",
           "需求种类": r["需求种类"] or "",
           "拨不动理由": (_需求理由(conn, r) or (_拨不动理由(家们[r["主用供应商"]])
                            if (r["主用供应商"] or "") in 家们
                            else "库里没有「" + (r["主用供应商"] or "") + "」这一家了")),
           "父功能": r["父功能"] or "",
           "客户机密": _带机密标(conn, r["功能名"]),
           "同时": _读同时(conn, r["功能名"]),
           "生图路子": (生图路子(家地址.get(r["主用供应商"] or "", ""))
                     if (r["种类"] or "") == "生图" else None),
           "吃参考图": (吃参考图吗(家地址.get(r["主用供应商"] or "", ""))
                     if (r["种类"] or "") == "生图" else None)}
          for r in conn.execute(
              "SELECT * FROM 功能 ORDER BY CASE WHEN IFNULL(父功能,'')='' THEN 功能名 ELSE 父功能 END,"
              f" IFNULL(父功能,'')<>'', {_族内序}")]
    日志条数, 日志跳过 = int(日志条数), int(日志跳过)
    if 日志条数 < 0 or 日志跳过 < 0:
        conn.close()
        raise ValueError("日志条数和跳过数不能是负数")
    汇 = conn.execute(
        "SELECT COUNT(*), IFNULL(SUM(时刻>=?),0), IFNULL(SUM(IFNULL(成没成,0)=0),0),"
        " IFNULL(SUM(时刻>=? AND IFNULL(成没成,0)=0),0),"
        " IFNULL(SUM((?='' OR 功能=?) AND (?=0 OR IFNULL(成没成,0)=0)),0) FROM 日志",
        (今天, 今天, 日志功能名, 日志功能名, int(日志只看失败))).fetchone()
    日志总数 = 汇[4]
    汇总 = {"今日调用": 汇[1], "总调用": 汇[0], "今日错误": 汇[3], "总错误": 汇[2]}
    志 = []
    for r in conn.execute(
            "SELECT * FROM 日志 WHERE (?='' OR 功能=?) AND (?=0 OR IFNULL(成没成,0)=0)"
            " ORDER BY rowid DESC LIMIT ? OFFSET ?",
            (日志功能名, 日志功能名, int(日志只看失败), 日志条数, 日志跳过)):
        错 = r["报错原文"] or ""
        志.append({"ID": _编号("RZ", r["号"]), "时刻": r["时刻"], "功能": r["功能"], "用了谁": r["用了谁"], "模型": r["模型"],
                   "成没成": bool(r["成没成"]), "耗时毫秒": r["耗时毫秒"],
                   "报错原文": 错 if 日志报错全文 else 错[:300],
                   "想了": r["想了"], "用力": r["用力"] or ""})
    项 = {r["项目名"]: {"备注": r["备注"] or "", "网址": r["网址"] or ""}
         for r in conn.execute("SELECT * FROM 项目笔记")}
    想过 = 想过账(conn)
    违规 = 机密违规(conn=conn)
    conn.close()
    return {"供应商": 供, "功能": 功, "项目": 项, "日志": 志, "日志总数": 日志总数, "汇总": 汇总,
            "想过": 想过, "预设上限": 预设上限, "档序": list(_档序), "机密违规": 违规}


def 设密钥(供应商: str, 密钥: str, 库: str | None = None) -> bool:
    密钥 = (密钥 or "").strip()
    坏 = next((c for c in 密钥 if not c.isascii()), None)
    if 坏 is not None:
        raise 底座错误(f"密钥里有个不是英文数字的字符「{坏}」,多半是复制的时候多带了东西"
                    f"(常见的是中文标点)。密钥都是纯英文数字,重新复制一遍再填。")
    conn = 连库(库)
    改 = conn.execute("UPDATE 供应商 SET 密钥=? WHERE 名=?",
                     (密钥, 供应商)).rowcount
    conn.commit()
    conn.close()
    return bool(改)


_类型们 = ("网页接口", "命令行")


_新家默认节流 = (3.0, 60)


名册文件 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "厂商名册.json")

_名册必填 = ("名", "类型", "地址")
_名册禁格 = ("密钥", "key", "apikey", "api_key", "Authorization")


def 名册() -> list[dict]:
    try:
        with open(名册文件, encoding="utf-8") as f:
            册 = json.load(f)
    except FileNotFoundError:
        return []
    except (OSError, ValueError) as e:
        raise 底座错误(f"厂商名册读不动({名册文件}):{e}")
    家们, 见过 = [], set()
    for i, 条 in enumerate(册.get("家们") or []):
        哪条 = f"厂商名册第 {i + 1} 条"
        if not isinstance(条, dict):
            raise 底座错误(f"{哪条}不是一个对象")
        缺 = [k for k in _名册必填 if not str(条.get(k) or "").strip()]
        if 缺:
            raise 底座错误(f"{哪条}缺这几格:{'、'.join(缺)}")
        名 = str(条["名"]).strip()
        if 条["类型"] not in _类型们:
            raise 底座错误(f"厂商名册「{名}」的类型只能是 {' 或 '.join(_类型们)},"
                        f"写的是「{条['类型']}」")
        带 = [k for k in _名册禁格 if k in 条]
        if 带:
            raise 底座错误(f"厂商名册「{名}」里带了 {'、'.join(带)} 这一格 —— "
                        f"这份文件进 git 也随安装包发出去,一个 key 都不许写进来")
        步 = 条.get("领key步骤")
        if 步 is not None and not (isinstance(步, list)
                                  and all(isinstance(x, str) and x.strip() for x in 步)):
            raise 底座错误(f"厂商名册「{名}」的领key步骤得是一串非空的句子(JSON 数组)")
        if 名 in 见过:
            raise 底座错误(f"厂商名册里「{名}」出现了两次,名字是主键不能重")
        见过.add(名)
        家们.append(条)
    return 家们


def 名册一家(名: str) -> dict | None:
    名 = (名 or "").strip()
    for 条 in 名册():
        if str(条["名"]).strip() == 名:
            return 条
    return None


def 加供应商(名: str, 类型: str = "", 地址: str = "", 模型们: str = "", 备注: str = "",
          库: str | None = None, 照名册: bool = False) -> str:
    条 = 名册一家(名) if 照名册 else None
    if 照名册 and 条 is None:
        raise 底座错误(f"厂商名册里没有「{(名 or '').strip()}」这一家。"
                    f"看名册里都有谁:python3 ai.py 名册")
    if 条:
        类型 = (类型 or "").strip() or str(条["类型"])
        地址 = (地址 or "").strip() or str(条["地址"])
        模型们 = (模型们 or "").strip() or str(条.get("模型们") or "")
        备注 = (备注 or "").strip() or str(条.get("备注") or "")
    名, 类型, 地址 = (名 or "").strip(), (类型 or "").strip(), (地址 or "").strip()
    备注 = (备注 or "").strip()
    if not 名:
        raise 底座错误("得给这一家起个名字,不能空着")
    if 类型 not in _类型们:
        raise 底座错误(f"类型只能是 {' 或 '.join(_类型们)},给的是「{类型}」")
    if not 地址:
        raise 底座错误("这一格不能空:网页接口那种填请求网址,命令行那种填命令名")
    清单 = ",".join(x.strip() for x in re.split(r"[,，]", 模型们 or "") if x.strip())
    for x in 清单.split(","):
        _拦禁用模型(x)

    conn = 连库(库)
    try:
        有 = conn.execute("SELECT 1 FROM 供应商 WHERE 名=?", (名,)).fetchone() is not None
        if 有:
            conn.execute("UPDATE 供应商 SET 类型=?, 地址=? WHERE 名=?", (类型, 地址, 名))
            if 清单:
                conn.execute("UPDATE 供应商 SET 模型们=? WHERE 名=?", (清单, 名))
            if 备注:
                conn.execute("UPDATE 供应商 SET 备注=? WHERE 名=?", (备注, 名))
        else:
            conn.execute(
                "INSERT INTO 供应商(名,类型,地址,密钥,备注,模型们,最小间隔秒,每小时上限) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (名, 类型, 地址, None, 备注, 清单, *_新家默认节流))
            if 类型 == "命令行" or _本机地址(地址):
                conn.execute("UPDATE 供应商 SET 吃订阅=1 WHERE 名=?", (名,))
            if 条:
                conn.execute(
                    "UPDATE 供应商 SET 强度档=?, 最小间隔秒=?, 每小时上限=?, "
                    "吃订阅=?, 免费=?, 只收前缀=?, 注册页=? WHERE 名=?",
                    (str(条.get("强度档") or "") or None,
                     float(条.get("最小间隔秒", _新家默认节流[0])),
                     int(条.get("每小时上限", _新家默认节流[1])),
                     1 if 条.get("吃订阅") else 0,
                     1 if 条.get("免费") else 0,
                     str(条.get("只收前缀") or "") or None,
                     str(条.get("注册页") or "") or None,
                     名))
        conn.commit()
    finally:
        conn.close()
    return "改了" if 有 else "新建"


def 加功能(功能名: str, 种类: str, 供应商: str, 模型: str = "",
        库: str | None = None) -> str:
    功能名, 种类, 供应商 = (功能名 or "").strip(), (种类 or "").strip(), (供应商 or "").strip()
    模型 = (模型 or "").strip()
    if not 功能名:
        raise 底座错误("得给这件活起个名字,不能空着")
    if 种类 not in _种类们:
        raise 底座错误(f"种类只能是 {' 或 '.join(_种类们)},给的是「{种类}」")
    conn = 连库(库)
    try:
        那家 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (供应商,)).fetchone()
        if 那家 is None:
            raise 底座错误(f"供应商表里没有「{供应商}」")
        if not 模型:
            模型 = next((x.strip() for x in (那家["模型们"] or "").split(",")
                       if x.strip() and not _禁用模型(x)), "")
        _拦禁用模型(模型)
        有 = conn.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone() is not None
        if 有:
            _守机密(conn, 功能名, 供应商, 模型)
        else:
            _守机密(conn, 功能名, 供应商, 模型, 族=_认爹(功能名, {r["功能名"] for r in conn.execute(
                "SELECT 功能名 FROM 功能")}) or 功能名)
        if 有:
            conn.execute("UPDATE 功能 SET 种类=?, 主用供应商=?, 主用模型=? WHERE 功能名=?",
                         (种类, 供应商, 模型, 功能名))
        else:
            有的名 = {r["功能名"] for r in conn.execute("SELECT 功能名 FROM 功能")}
            conn.execute(_插功能行,
                         (功能名, 供应商, 模型, 种类, _认爹(功能名, 有的名)))
        conn.commit()
    finally:
        conn.close()
    return "改了" if 有 else "新建"


_地址尾巴 = ("/chat/completions", "/completions", "/responses",
          "/images/generations", "/embeddings", "/ai/run")


def _模型清单地址(地址: str) -> str:
    地址 = (地址 or "").strip()
    if "/models/" in 地址:
        return 地址.split("/models/")[0] + "/models"
    for 尾 in _地址尾巴:
        if 地址.endswith(尾):
            return 地址[:-len(尾)] + "/models"
    return 地址.rstrip("/") + "/models"


def 拼地址(半截: str, 尾: str = "/chat/completions") -> str:
    半截 = (半截 or "").strip()
    if not 半截:
        return ""
    if "/models/" in 半截:
        return 半截
    for 已有 in _地址尾巴:
        if 半截.rstrip("/").endswith(已有):
            return 半截.rstrip("/")
    return 半截.rstrip("/") + 尾


def 地址尾巴们() -> list[str]:
    return list(_地址尾巴)


def _清单看图(体: dict) -> dict:
    出 = {}
    if isinstance(体.get("data"), list):
        对 = [(m.get("id"), (m.get("architecture") or {}).get("input_modalities"))
             for m in 体["data"] if isinstance(m, dict) and isinstance(m.get("architecture"), dict)]
    elif isinstance(体.get("models"), list):
        对 = [(str(m.get("name") or "").split("/", 1)[-1], m.get("supportedInputModalities"))
             for m in 体["models"] if isinstance(m, dict)]
    else:
        对 = []
    for 名, 收 in 对:
        if 名 and isinstance(收, list):
            出[名] = "能" if any(str(x).lower() == "image" for x in 收) else "不能"
    return 出


def _拆模型清单(体: dict) -> list[str]:
    if isinstance(体.get("data"), list):
        名们 = [m.get("id") for m in 体["data"] if isinstance(m, dict)]
    elif isinstance(体.get("models"), list):
        名们 = [str(m.get("name") or "").split("/", 1)[-1]
               for m in 体["models"] if isinstance(m, dict)]
    else:
        名们 = []
    出, 见过 = [], set()
    for 名 in 名们:
        名 = (名 or "").strip()
        if 名 and 名 not in 见过:
            见过.add(名)
            出.append(名)
    return 出


def _笔记行(conn, 供应商: str, 模型: str):
    return conn.execute("SELECT * FROM 模型笔记 WHERE 供应商=? AND 模型=?",
                        (供应商, 模型)).fetchone()


def _记一格(conn, 供应商: str, 模型: str, **格):
    if not (供应商 and 模型):
        raise 底座错误("得说清是哪一家的哪个模型")
    if _笔记行(conn, 供应商, 模型) is None:
        conn.execute("INSERT INTO 模型笔记(供应商,模型) VALUES(?,?)", (供应商, 模型))
    if 格:
        句 = ",".join(f"{k}=?" for k in 格)
        conn.execute(f"UPDATE 模型笔记 SET {句} WHERE 供应商=? AND 模型=?",
                     (*格.values(), 供应商, 模型))


def 藏(供应商: str, 模型: str, 为什么: str = "", 库: str | None = None) -> bool:
    供应商, 模型 = (供应商 or "").strip(), (模型 or "").strip()
    if not (供应商 and 模型):
        raise 底座错误("得说清藏哪一家的哪个模型")
    conn = 连库(库)
    try:
        行 = _笔记行(conn, 供应商, 模型)
        新 = 行 is None or not 行["藏了"]
        格 = {"藏了": 1, "何时": time.strftime("%Y-%m-%d %H:%M:%S")}
        if (为什么 or "").strip():
            格["备注"] = 为什么.strip()[:500]
        _记一格(conn, 供应商, 模型, **格)
        conn.commit()
    finally:
        conn.close()
    return 新


def 放回(供应商: str, 模型: str, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        改 = conn.execute("UPDATE 模型笔记 SET 藏了=0 WHERE 供应商=? AND 模型=? AND 藏了=1",
                         ((供应商 or "").strip(), (模型 or "").strip())).rowcount
        conn.commit()
    finally:
        conn.close()
    return bool(改)


_免费档 = ("免费", "收费", "查不到", "")


def 记笔记(供应商: str, 模型: str, 备注: str | None = None, 判断: str | None = None,
        库: str | None = None, 免费: str | None = None, 免费出处: str | None = None) -> bool:
    供应商, 模型 = (供应商 or "").strip(), (模型 or "").strip()
    格 = {}
    if 免费 is not None:
        免费 = str(免费).strip()
        if 免费 not in _免费档:
            raise 底座错误(f"「免费」那一格只收 免费 / 收费 / 查不到 / 空,收到的是「{免费}」")
        格["免费"] = 免费
    if 免费出处 is not None:
        格["免费出处"] = str(免费出处).strip()[:500]
    if 备注 is not None:
        格["备注"] = str(备注).strip()[:500]
    if 判断 is not None:
        格["判断"] = str(判断).strip()[:500]
    conn = 连库(库)
    try:
        _记一格(conn, 供应商, 模型, **格)
        conn.commit()
    finally:
        conn.close()
    return True


_看图题 = "这张图是什么颜色?只回颜色的名字,一两个字。"
_看图色们 = (
    ("红", (0xDC, 0x1E, 0x1E), ("红", "red")),
    ("蓝", (0x1E, 0x3C, 0xDC), ("蓝", "blue")),
    ("绿", (0x1E, 0xB4, 0x3C), ("绿", "green")),
    ("黄", (0xF0, 0xD2, 0x1E), ("黄", "yellow")),
)


def _挑看图色():
    return secrets.choice(_看图色们)


def _认出色(答: str, 色) -> bool:
    def 点到(认) -> bool:
        字, 词 = 认
        return 字 in 答 or re.search(rf"\b{词}\b", 答, re.I) is not None
    return 点到(色[2]) and not any(点到(别[2]) for 别 in _看图色们 if 别 is not 色)


def _纯色图(r: int = 0xDC, g: int = 0x1E, b: int = 0x1E, 边: int = 64) -> bytes:
    def 块(类: bytes, 数据: bytes) -> bytes:
        return (struct.pack(">I", len(数据)) + 类 + 数据
                + struct.pack(">I", zlib.crc32(类 + 数据) & 0xFFFFFFFF))
    行 = b"\x00" + bytes((r, g, b)) * 边
    return (b"\x89PNG\r\n\x1a\n"
            + 块(b"IHDR", struct.pack(">IIBBBBB", 边, 边, 8, 2, 0, 0, 0))
            + 块(b"IDAT", zlib.compress(行 * 边))
            + 块(b"IEND", b""))


def _纯色图的色(图: bytes) -> tuple:
    长 = struct.unpack(">I", 图[33:37])[0]
    return tuple(zlib.decompress(图[41:41 + 长])[1:4])


def _怪图(e: Exception) -> bool:
    原 = getattr(e, "原因", e)
    if not isinstance(原, urllib.error.HTTPError) or 原.code != 400:
        return False
    话 = _报错体(原).lower()
    return any(w in 话 for w in ("image", "vision", "multimodal", "content must be a string",
                                   "content.type"))


def _递得进图(类型: str) -> bool:
    return (类型 or "") in ("网页接口", "命令行")


def 试模型(供应商: str, 模型: str, 库: str | None = None, 超时: int = 60) -> dict:
    供应商, 模型 = (供应商 or "").strip(), (模型 or "").strip()
    if not (供应商 and 模型):
        raise 底座错误("得说清试哪一家的哪个模型")
    conn = 连库(库)
    收: dict = {}
    try:
        供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (供应商,)).fetchone()
        if 供 is None:
            raise 底座错误(f"供应商表里没有「{供应商}」")
        地址 = (供["地址"] or "").strip()
        if 供["吃订阅"] and not (供["已同意"] or "").strip():
            raise 缺配置(f"「{供应商}」烧的是你账号的订阅额度,还没点过"
                        f"「我知道有账号风险,开启」,这一下不发。")
        笔 = _笔记行(conn, 供应商, 模型)
        看图 = (笔["看图"] if 笔 else "") or ""
        看图来源 = (笔["看图来源"] if 笔 else "") or ""
        看图说 = ""
        定了 = False
        色 = _挑看图色()
        图 = _纯色图(*色[1])
        if not _递得进图(供["类型"]):
            看图, 看图来源, 定了 = "不能", "这条路递不进", True
            看图说 = "看图:这条路递不进图,模型本身能不能看不知道"
        if 供["类型"] == "网页接口":
            _要密钥(供)
            if "images" in 地址.lower() or "generatecontent" in 地址.lower():
                raise 底座错误(f"「{供应商}」填的是生图那条网址,连通测试只走聊天那条 —— "
                            f"画一张真烧额度,不适合拿来一屏点几十下。")

            def 发(带图: bool):
                载荷 = {
                    "model": 模型,
                    "messages": [{"role": "user",
                                  "content": _拼话(_看图题, [图]) if 带图 else "回两个字:收到"}],
                    "temperature": 1.0,
                    "max_tokens": 8192,
                    "stream": False,
                }
                return lambda: _发网页请求(地址, 供["密钥"], 载荷, 超时, 收)
            带图 = not (看图 == "不能" and 看图来源 == "清单自报")
        elif 供["类型"] == "命令行":
            def 发(带图: bool):
                return lambda: _发命令行请求(地址 or "claude", 模型, "",
                                         _看图题 if 带图 else "回两个字:收到", False, 超时, 关档,
                                         参考图=[图] if 带图 else ())
            带图 = True
        else:
            raise 底座错误(f"供应商「{供应商}」的类型「{供['类型']}」不认识")

        try:
            try:
                答 = (_跑(conn, "(连通测试)", 供应商, 模型, 发(带图), 0, 收) or "").strip()
            except 底座错误 as e:
                if not (带图 and _怪图(e)):
                    raise
                看图, 看图来源, 定了, 带图 = "不能", "测试", True, False
                看图说 = "不能看图:递了一张图,接口回说不收图"
                答 = (_跑(conn, "(连通测试)", 供应商, 模型, 发(False), 0, 收) or "").strip()
            通了 = bool(答)
            话 = 答[:200] if 答 else "回是回了,但正文是空的 —— 这样的模型拿不到话,当不通算"
            if 通了 and 带图:
                定了, 看图来源 = True, "测试"
                if _认出色(答, 色):
                    看图, 看图说 = "能", f"能看图:递了一张{色[0]}色小图,它答对了颜色"
                else:
                    看图, 看图说 = "不能", f"当不能看图算:递了一张{色[0]}色小图,它答的是「{答[:30]}」"
        except 撞上限:
            raise
        except Exception as e:
            通了, 话 = False, _抹密钥(conn, str(e))[:300]

        测速 = None
        if 通了:
            一行 = conn.execute(
                "SELECT 耗时毫秒 FROM 日志 WHERE 功能='(连通测试)' AND 成没成=1 AND 用了谁=? AND 模型=?"
                " ORDER BY rowid DESC LIMIT 1", (供应商, 模型)).fetchone()
            测速 = 一行[0] if 一行 else None
        测于 = time.strftime("%Y-%m-%d %H:%M:%S")
        格 = {"连通": "通" if 通了 else "不通", "测于": 测于, "测出的话": 话, "测速毫秒": 测速}
        if 定了:
            格.update(看图=看图, 看图来源=看图来源)
        _记一格(conn, 供应商, 模型, **格)
        conn.commit()
        return {"通了": 通了, "话": 话, "测于": 测于, "看图": 看图, "看图来源": 看图来源,
                "看图说": 看图说, "测速毫秒": 测速}
    finally:
        conn.close()


_探针值 = "__ai_base_probe__"


def _从话里认档(话: str, 挨着: str = "") -> list:
    话 = 话 or ""
    if 挨着:
        位 = 话.find(挨着)
        if 位 < 0:
            return []
        话 = 话[位:位 + 300]
    找 = {x.lower() for x in re.findall(r"\b(" + "|".join(_档序) + r")\b", 话, re.I)}
    return [x for x in _档序 if x in 找] if len(找) >= 2 else []


def 探档位(供应商: str, 模型: str, 库: str | None = None, 超时: int = 60) -> dict:
    供应商, 模型 = (供应商 or "").strip(), (模型 or "").strip()
    if not (供应商 and 模型):
        raise 底座错误("得说清探哪一家的哪个模型")
    conn = 连库(库)
    try:
        供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (供应商,)).fetchone()
        if 供 is None:
            raise 底座错误(f"供应商表里没有「{供应商}」")
        地址 = (供["地址"] or "").strip()
        if 供["吃订阅"] and not (供["已同意"] or "").strip():
            raise 缺配置(f"「{供应商}」烧的是你账号的订阅额度,还没点过"
                        f"「我知道有账号风险,开启」,这一下不发。")

        if 供["类型"] == "命令行":
            档们, 来源, 话 = _探命令行档位(地址 or "claude", 超时)
        elif 供["类型"] == "网页接口":
            _要密钥(供)
            if "images" in 地址.lower() or "generatecontent" in 地址.lower():
                raise 底座错误(f"「{供应商}」填的是生图那条网址,生图没有推理强度这一格,不用探。")
            _限速(conn, 供应商)
            档们, 来源, 话 = _探网页档位(地址, 供["密钥"] or "", 模型, 超时)
            话 = _抹密钥(conn, 话)
        else:
            raise 底座错误(f"供应商「{供应商}」的类型「{供['类型']}」不认识")

        探于 = time.strftime("%Y-%m-%d %H:%M:%S")
        _记一格(conn, 供应商, 模型, 强度档=",".join(档们), 档位来源=来源, 档位探于=探于,
              档位指纹=_通道指纹(供["类型"], 地址, 模型))
        conn.commit()
        return {"档们": 档们, "来源": 来源, "话": 话[:400], "探于": 探于}
    finally:
        conn.close()


def _探网页档位(地址: str, 密钥: str, 模型: str, 超时: int):
    载荷 = {"model": 模型,
          "messages": [{"role": "user", "content": "hi"}],
          "max_tokens": 16, "stream": False,
          "reasoning_effort": _探针值}
    try:
        体 = _打(地址, 密钥, 载荷, 超时)
    except urllib.error.HTTPError as e:
        话 = ""
        try:
            话 = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        档们 = _从话里认档(话)
        if 档们:
            return 档们, "接口自报", 话
        return [], "探不出来", f"HTTP {e.code}: {话}"
    except Exception as e:
        raise 底座错误(f"探不成 {地址}:{type(e).__name__}: {e}") from e
    想 = _想了多少(体, 地址)
    return [], "不吃这一格", (f"发了一个写错的值「{_探针值}」,它没报错、照样回了话"
                          + (f"(这次想了 {想} 个字)" if 想 is not None else "(它不报想了多少)"))


def _探命令行档位(可执行: str, 超时: int):
    try:
        完 = subprocess.run([_找命令(可执行) or 可执行, "--help"],
                           capture_output=True, text=True, timeout=超时)
    except Exception as e:
        raise 底座错误(f"跑不动 `{可执行} --help`:{type(e).__name__}: {e}") from e
    话 = (完.stdout or "") + (完.stderr or "")
    档们 = _从话里认档(话, 挨着="--effort")
    if 档们:
        位 = 话.find("--effort")
        return 档们, "接口自报", 话[位:位 + 200].strip()
    return [], "探不出来", f"`{可执行} --help` 里没找到 --effort 那一行认得的档名"


def 藏着的(供应商: str = "", 库: str | None = None) -> list:
    conn = 连库(库)
    try:
        供应商 = (供应商 or "").strip()
        行 = (conn.execute("SELECT * FROM 模型笔记 WHERE 藏了=1 AND 供应商=? ORDER BY 模型",
                          (供应商,))
              if 供应商 else
              conn.execute("SELECT * FROM 模型笔记 WHERE 藏了=1 ORDER BY 供应商, 模型"))
        return [dict(r) for r in 行]
    finally:
        conn.close()


def 问模型清单(供应商: str, 库: str | None = None, 超时: int = 20) -> dict:
    conn = 连库(库)
    try:
        供 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (供应商,)).fetchone()
        if 供 is None:
            raise 底座错误(f"供应商表里没有「{供应商}」")
        if 供["类型"] == "命令行":
            raise 底座错误(
                f"「{供应商}」是本机命令那一种,没有「列模型」这个接口 —— 它调的是这台电脑上的 "
                f"`{供['地址']}` 程序,不是网址,问不出清单来。它能用哪些模型,只能照那个程序"
                f"自己的说明手填进「模型们」。")
        _要密钥(供)
        地址 = _模型清单地址(供["地址"] or "")
        try:
            请求 = urllib.request.Request(
                地址, headers={"Authorization": f"Bearer {供['密钥'] or ''}",
                              "User-Agent": _UA}, method="GET")
            with urllib.request.urlopen(请求, timeout=超时) as 回:
                体 = json.loads(回.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise 底座错误(
                f"问 {地址} 回了 HTTP {e.code}。两种可能:密钥不对,"
                f"或者这一家列模型的地址不长这样 —— 底座是拿它的调用地址换算出来的,"
                f"换算不出来的家只能手填模型清单。") from e
        except Exception as e:
            话 = _抹密钥(conn, str(e), 供["密钥"] or "")
            raise 底座错误(f"问不到 {地址}:{e.__class__.__name__}: {话}") from e
        清单 = _拆模型清单(体 if isinstance(体, dict) else {})
        if not 清单:
            raise 底座错误(f"{地址} 是通的,但里头没认出一个模型名。它回的是:"
                        f"{_抹密钥(conn, json.dumps(体, ensure_ascii=False), 供['密钥'] or '')[:200]}")
        原来 = [x.strip() for x in (供["模型们"] or "").split(",") if x.strip()]
        混着卖 = bool(供["免费"]) and any(_像免费的(x) for x in 清单)
        服务端有 = set(清单)
        藏 = {r["模型"] for r in conn.execute(
            "SELECT 模型 FROM 模型笔记 WHERE 供应商=? AND 藏了=1", (供应商,))}
        藏了 = [x for x in 清单 if x in 藏]
        清单 = [x for x in 清单 if x not in 藏]

        滤掉 = []
        前缀们 = [x.strip() for x in re.split(r"[,，]", 供["只收前缀"] or "") if x.strip()]
        if 前缀们:
            滤掉 += [x for x in 清单 if not _对得上前缀(x, 前缀们)]
            清单 = [x for x in 清单 if _对得上前缀(x, 前缀们)]
        滤掉 += [x for x in 清单 if _禁用模型(x)]
        清单 = [x for x in 清单 if not _禁用模型(x)]
        if 混着卖:
            滤掉 += [x for x in 清单 if not _像免费的(x)]
            清单 = [x for x in 清单 if _像免费的(x)]
        该留 = set(清单) | {x for x in 藏了 if (not 前缀们 or _对得上前缀(x, 前缀们))
                            and (not 混着卖 or _像免费的(x))}
        在用 = {r["主用模型"] for r in conn.execute(
            "SELECT 主用模型 FROM 功能 WHERE 主用供应商=?", (供应商,))}
        清走 = [r["模型"] for r in conn.execute(
            "SELECT 模型 FROM 模型笔记 WHERE 供应商=? ORDER BY 模型", (供应商,))
                if r["模型"] not in 该留 and r["模型"] not in 在用]
        conn.executemany("DELETE FROM 模型笔记 WHERE 供应商=? AND 模型=?",
                         [(供应商, m) for m in 清走])
        自报 = _清单看图(体 if isinstance(体, dict) else {})
        for 名 in 清单:
            旧 = _笔记行(conn, 供应商, 名)
            if 名 in 自报 and (旧 is None or (旧["看图来源"] or "") != "测试"):
                _记一格(conn, 供应商, 名, 看图=自报[名], 看图来源="清单自报")
        conn.execute("UPDATE 供应商 SET 模型们=?, 清单于=? WHERE 名=?",
                     (",".join(清单), time.strftime("%Y-%m-%d %H:%M:%S"), 供应商))
        conn.commit()
    finally:
        conn.close()
    return {"清单": 清单, "地址": 地址, "原来": 原来, "滤掉": 滤掉, "藏了": 藏了,
            "不认了": [x for x in 原来 if x not in 服务端有], "清走": 清走,
            "服务端有": sorted(服务端有)}


def 巡检(库: str | None = None, 超时: int = 60) -> dict:
    配 = 读配置(库, 日志条数=0)
    家们 = {s["名"]: s for s in 配["供应商"]}
    拉, 在用不列了 = [], []
    在用 = {}
    for f in 配["功能"]:
        if f["启用"] and f["种类"] != "生图":
            在用.setdefault((f["主用供应商"], f["主用模型"]), []).append(f["功能名"])
    for s in 配["供应商"]:
        if (s["类型"] != "网页接口" or s["拨不动理由"]
                or not s["地址"].rstrip("/").endswith("/chat/completions")):
            continue
        try:
            r = 问模型清单(s["名"], 库=库)
        except Exception as e:
            拉.append({"家": s["名"], "错": str(e)[:300]})
            continue
        新来 = [x for x in r["清单"] if x not in r["原来"]]
        拉.append({"家": s["名"], "共": len(r["清单"]), "新来": 新来, "不认了": r["不认了"]})
        for (家, m), 功能们 in sorted(在用.items()):
            if 家 == s["名"] and m not in r["服务端有"]:
                在用不列了.append({"家": 家, "模型": m, "功能": 功能们})
    测, 跳过 = [], []
    for (家, 模型), 功能们 in sorted(在用.items()):
        s = 家们.get(家)
        if s is None or s["拨不动理由"]:
            跳过.append({"家": 家, "模型": 模型, "为什么": (s or {}).get("拨不动理由") or "库里没有这一家"})
        elif s["吃订阅"]:
            跳过.append({"家": 家, "模型": 模型, "为什么": "吃订阅,不真测(看近 7 天调用记录)"})
        else:
            try:
                r = 试模型(家, 模型, 库=库, 超时=超时)
                测.append({"家": 家, "模型": 模型, "通了": r["通了"], "话": r["话"][:120]})
            except 底座错误 as e:
                跳过.append({"家": 家, "模型": 模型, "为什么": str(e)[:200]})
    余额 = []
    for s in 配["供应商"]:
        if s["查得了余额"] and s["有密钥"]:
            try:
                余额.append({"家": s["名"], "余额": 查余额(s["名"], 库=库)["余额"]})
            except 底座错误 as e:
                余额.append({"家": s["名"], "错": str(e)[:200]})
    return {"拉": 拉, "测": 测, "跳过": 跳过, "在用不列了": 在用不列了, "余额": 余额}


_免费例外 = {"big-pickle"}


def _像免费的(模型名: str) -> bool:
    return 模型名.endswith("-free") or 模型名 in _免费例外


def _对得上前缀(模型名: str, 前缀们: list[str]) -> bool:
    低 = 模型名.lower()
    return any(低.startswith(p.lower()) for p in 前缀们)


def _自动档名(族名: str, 家: str, 模型: str) -> str:
    return f"{族名} · {家}/{模型}"


def 列口(族名: str, 库: str | None = None) -> dict:
    族名 = (族名 or "").strip()
    conn = 连库(库)
    try:
        挑中, 手工的, 种类 = [], [], ""
        for r in conn.execute(f"SELECT * FROM 功能 ORDER BY {_族内序}"):
            名 = r["功能名"]
            if 名 == 族名:
                种类 = 种类 or (r["种类"] or "文本")
                continue
            if not 名.startswith(族名 + " · "):
                continue
            种类 = 种类 or (r["种类"] or "文本")
            尾 = 名[len(族名) + 3:]
            if "/" in 尾:
                挑中.append(尾)
            else:
                手工的.append(名)
    finally:
        conn.close()
    return {"族名": 族名, "种类": 种类 or "文本", "挑中": 挑中, "手工的": 手工的}


预设上限 = 3


def _拦上限(现有条数: int, 族名: str, 要加几行: int = 1):
    if 现有条数 + 要加几行 > 预设上限:
        raise 底座错误(
            f"「{族名}」最多摆 {预设上限} 个模型(含它自己那一行),现在有 {现有条数} 个。"
            f"要换别的,先把不用的那个删掉。")


def 加备选(族名: str, 供应商: str, 模型: str, 显示名: str = "",
         种类: str = "", 库: str | None = None) -> str:
    族名, 供应商, 模型 = (族名 or "").strip(), (供应商 or "").strip(), (模型 or "").strip()
    显示名 = (显示名 or "").strip()
    if not (族名 and 供应商 and 模型):
        raise 底座错误("要说清楚:挂到哪条功能下、用哪一家、哪个模型")
    _拦禁用模型(模型)
    if "/" in 显示名:
        raise 底座错误("这个名字里不能有斜杠 —— 带斜杠的名字是留给自动建的那种行的")
    这条 = 列口(族名, 库=库)
    全名 = f"{族名} · {显示名}" if 显示名 else _自动档名(族名, 供应商, 模型)
    conn = 连库(库)
    try:
        if conn.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (全名,)).fetchone():
            raise 底座错误(f"已经有「{全名}」这一行了")
        if not conn.execute("SELECT 1 FROM 供应商 WHERE 名=?", (供应商,)).fetchone():
            raise 底座错误(f"供应商表里没有「{供应商}」")
        _守机密(conn, 族名, 供应商, 模型, 族=族名)
        族名行 = 1 if conn.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (族名,)).fetchone() else 0
        _拦上限(族名行 + len(这条["挑中"]) + len(这条["手工的"]), 族名)
        conn.execute(_插功能行,
                     (全名, 供应商, 模型, (种类 or 这条["种类"]), 族名))
        conn.commit()
    finally:
        conn.close()
    return 全名


def 设档(族名: str, 挑中: list, 种类: str = "", 库: str | None = None) -> dict:
    族名 = (族名 or "").strip()
    种类 = (种类 or "").strip()
    if not 族名:
        raise 底座错误("得先说给哪条口挑 —— 填那条口的名字,比如「示例 · 生成」")
    单子 = []
    for x in (挑中 or []):
        x = str(x).strip()
        if not x:
            continue
        if "/" not in x:
            raise 底座错误(f"挑的这一项看不出是哪家的哪个模型:「{x}」。要写成「家/模型」。")
        _拦禁用模型(x.split("/", 1)[1])
        if x not in 单子:
            单子.append(x)
    if not 种类:
        种类 = 列口(族名, 库=库)["种类"]
    if 种类 not in _种类们:
        raise 底座错误(f"种类只能是 {' 或 '.join(_种类们)},给的是「{种类}」")

    conn = 连库(库)
    try:
        家们 = {r["名"] for r in conn.execute("SELECT 名 FROM 供应商")}
        要建 = []
        for 项 in 单子:
            家, 模 = 项.split("/", 1)
            家, 模 = 家.strip(), 模.strip()
            if 家 not in 家们:
                raise 底座错误(f"供应商表里没有「{家}」")
            if not 模:
                raise 底座错误(f"「{项}」没写模型名")
            _守机密(conn, 族名, 家, 模, 族=族名)
            要建.append((_自动档名(族名, 家, 模), 家, 模))

        现有, 碰不到 = {}, 0
        for r in conn.execute("SELECT 功能名 FROM 功能"):
            名 = r["功能名"]
            if 名 == 族名:
                碰不到 += 1
                continue
            if not 名.startswith(族名 + " · "):
                continue
            尾 = 名[len(族名) + 3:]
            if "/" in 尾:
                现有[名] = 尾
            else:
                碰不到 += 1

        _拦上限(碰不到, 族名, len(要建))

        新建, 已有 = [], []
        for 名, 家, 模 in 要建:
            if 名 in 现有:
                已有.append(名)
                continue
            conn.execute(_插功能行,
                         (名, 家, 模, 种类, 族名))
            新建.append(名)
        留下 = {名 for 名, _, _ in 要建}
        删掉 = sorted(名 for 名 in 现有 if 名 not in 留下)
        for 名 in 删掉:
            conn.execute("DELETE FROM 功能 WHERE 功能名=?", (名,))
        conn.commit()
    finally:
        conn.close()
    return {"族名": 族名, "新建": 新建, "已有": 已有, "删掉": 删掉}


def 删功能(功能名: str, 库: str | None = None) -> bool:
    功能名 = (功能名 or "").strip()
    if not 功能名:
        raise 底座错误("得说清删哪一行:python3 ai.py 删功能 \"<功能名>\"")
    conn = 连库(库)
    try:
        改 = conn.execute("DELETE FROM 功能 WHERE 功能名=?", (功能名,)).rowcount
        conn.commit()
    finally:
        conn.close()
    return bool(改)


def 删供应商(名: str, 库: str | None = None) -> bool:
    名 = (名 or "").strip()
    if not 名:
        raise 底座错误("得说清删哪一家:python3 ai.py 删供应商 \"<供应商名>\"")
    conn = 连库(库)
    try:
        用着 = [r[0] for r in conn.execute(
            "SELECT 功能名 FROM 功能 WHERE 主用供应商=? ORDER BY 功能名", (名,))]
        if 用着:
            头 = "、".join(f"「{x}」" for x in 用着[:3]) + ("等" if len(用着) > 3 else "")
            raise 底座错误(f"还有 {len(用着)} 条功能拨给「{名}」({头})—— "
                        "去下面「功能」那一块,把这几条的「模型供应商」改选别家,再回来删这一家")
        改 = conn.execute("DELETE FROM 供应商 WHERE 名=?", (名,)).rowcount
        conn.execute("DELETE FROM 模型笔记 WHERE 供应商=?", (名,))
        conn.commit()
    finally:
        conn.close()
    return bool(改)


def _模型版本(名: str):
    g = re.fullmatch(r"gpt-(\d+(?:\.\d+)*)(?:-([a-z]+))?", 名)
    if g:
        尾 = g[2] or ""
        if 尾 in {"preview", "latest", "image", "audio", "realtime", "codex", "chat"}:
            return None
        版本 = [int(x) for x in g[1].split(".")]
        while len(版本) > 1 and 版本[-1] == 0:
            版本.pop()
        return ("gpt", 尾), tuple(版本)
    c = re.fullmatch(r"claude-(sonnet|opus|haiku)-(\d+)(?:-(\d+))?(?:-(\d{8}))?", 名)
    if c:
        小, 日期 = c[3] or "0", c[4] or "0"
        if len(小) == 8 and not c[4]:
            小, 日期 = "0", 小
        return ("claude", c[1]), (int(c[2]), int(小), int(日期))
    return None


def _新版模型(当前: str, 清单: list[str], 命令行: bool = False) -> str | None:
    旧 = _模型版本(当前)
    if 旧 is None:
        return None
    if 命令行:
        别名 = 旧[0][1] if 旧[0][0] == "claude" else ""
        return 别名 if 别名 and 别名 in 清单 else None
    可换 = [(v[1], n) for n in 清单 if (v := _模型版本(n))
            and v[0] == 旧[0] and v[1] > 旧[1]]
    return max(可换)[1] if 可换 else None


def _更新快照(conn) -> dict:
    家们 = {}
    for r in conn.execute("SELECT * FROM 供应商 ORDER BY 名"):
        s = {k: r[k] for k in ("名", "类型", "地址", "吃订阅", "已同意", "只收前缀", "免费",
                               "强度档", "最小间隔秒", "每小时上限")}
        s["密钥指纹"] = hashlib.sha256((r["密钥"] or "").encode("utf-8")).hexdigest()
        s.update(模型们=[x.strip() for x in (r["模型们"] or "").split(",") if x.strip()],
                 要密钥=r["类型"] != "命令行", 有密钥=bool((r["密钥"] or "").strip()),
                 本机可用=本机可用(r["类型"], r["地址"] or ""))
        s["拨不动理由"] = _拨不动理由(s)
        s["隐藏"] = sorted(x[0] for x in conn.execute(
            "SELECT 模型 FROM 模型笔记 WHERE 供应商=? AND 藏了=1", (r["名"],)))
        家们[r["名"]] = s
    return {"供应商": 家们, "功能": [dict(r) for r in conn.execute("SELECT * FROM 功能 ORDER BY 功能名")]}


def _换新计划(快照: dict) -> dict:
    行们, 更新, 别名, 跳过, 固定 = [], [], [], [], []
    在用家 = set()
    for f in sorted(快照["功能"], key=lambda f: (f["父功能"] or f["功能名"],
                    bool(f["父功能"]), f.get("顺序") or 0, f["功能名"])):
        if not f["启用"] or f["种类"] != "文本":
            continue
        s = 快照["供应商"].get(f["主用供应商"])
        if not s:
            continue
        旧 = f["主用模型"] or ""
        if not (旧.startswith(("gpt-", "claude-"))
                or s["类型"] == "命令行" and 旧 in _CL模型.split(",")):
            continue
        在用家.add(s["名"])
        清单 = (_CL模型.split(",") if s["类型"] == "命令行" else s["模型们"])
        清单 = list(dict.fromkeys(m for m in 清单 if m not in s["隐藏"]))
        行 = {"ID": _编号("GN", f.get("号")), "功能名": f["功能名"], "供应商": s["名"], "旧模型": 旧,
              "用力": f["用力"] or 关档, "父功能": f["父功能"] or "",
              "可选模型": 清单, "新模型": "", "类型": s["类型"],
              "不提新版": bool(f.get("不提新版", 0)), "原因": ""}
        if 行["不提新版"]:
            行["状态"] = "已固定"
            固定.append(行)
        elif s["拨不动理由"]:
            行.update(状态="拨不动", 原因=s["拨不动理由"])
            跳过.append(行)
        elif s["类型"] == "命令行" and 旧 in _CL模型.split(","):
            行.update(状态="客户端定版本", 原因="版本由 Claude 客户端决定")
            别名.append(行)
        else:
            新 = _新版模型(旧, 清单, 命令行=s["类型"] == "命令行")
            if 新:
                行.update(状态="有新版", 新模型=新)
                更新.append(行)
            else:
                行["状态"] = "已是最新" if 旧 in 清单 else "清单里没有当前模型"
                行["原因"] = "清单中未找到同系列正式新版"
                跳过.append(行)
        行们.append(行)
    校 = {"功能": 快照["功能"], "供应商": {k: 快照["供应商"][k] for k in sorted(在用家)}}
    指纹 = hashlib.sha256(json.dumps(校, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    return {"行": 行们, "更新": 更新, "别名": 别名, "跳过": 跳过, "已固定": 固定, "指纹": 指纹}


def 设不提新版(功能名: str, 不提新版: bool, 库: str | None = None) -> None:
    if not isinstance(不提新版, bool) or not isinstance(功能名, str):
        raise 底座错误("开关只收 true / false，功能名必须是文字")
    conn = 连库(库)
    try:
        if not conn.execute("UPDATE 功能 SET 不提新版=? WHERE 功能名=?", (int(不提新版), 功能名)).rowcount:
            raise 底座错误("功能已不存在，请刷新页面")
    finally:
        conn.close()


def 模型更新预览(库: str | None = None) -> dict:
    conn = 连库(库)
    try:
        p = _换新计划(_更新快照(conn))
        家们 = sorted({r["供应商"] for r in p["行"] if r["类型"] == "网页接口"})
        p["上次检查"] = conn.execute(
            f"SELECT MAX(清单于) FROM 供应商 WHERE 名 IN ({','.join('?' * len(家们))})",
            家们).fetchone()[0] or "" if 家们 else ""
        return p
    finally:
        conn.close()


def 检查模型更新(库: str | None = None) -> dict:
    conn = 连库(库)
    try:
        快 = _更新快照(conn)
    finally:
        conn.close()
    名们 = {f["主用供应商"] for f in 快["功能"] if f["启用"] and f["种类"] == "文本"
           and (f["主用模型"] or "").startswith(("gpt-", "claude-"))}
    刷新 = []
    for 名 in sorted(名们):
        s = 快["供应商"].get(名)
        if not s or s["类型"] != "网页接口":
            continue
        if s["拨不动理由"]:
            刷新.append({"供应商": 名, "错": s["拨不动理由"]})
            continue
        try:
            r = 问模型清单(名, 库=库)
            刷新.append({"供应商": 名, "数量": len(r["清单"])})
        except 底座错误 as e:
            c错 = 连库(库)
            try:
                话 = _抹密钥(c错, str(e))
            finally:
                c错.close()
            刷新.append({"供应商": 名, "错": 话})
    p = 模型更新预览(库)
    return _带检查结果(p, 刷新)


def _带检查结果(p: dict, 刷新: list[dict]) -> dict:
    错们 = {r["供应商"]: r["错"] for r in 刷新 if r.get("错")}
    if 错们:
        p["指纹"] = ""
        for r in p["行"]:
            if r["供应商"] in 错们 and not r["不提新版"]:
                r.update(状态="拨不动", 新模型="", 原因=错们[r["供应商"]])
        p["更新"] = [r for r in p["行"] if r["状态"] == "有新版"]
        p["别名"] = [r for r in p["行"] if r["状态"] == "客户端定版本"]
        p["跳过"] = [r for r in p["行"] if r["状态"] not in {"有新版", "客户端定版本", "已固定"}]
    p["刷新"] = 刷新
    p["刷新失败"] = sorted(错们)
    return p


def _更新族快照(conn, 族们: list[str]) -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM 功能 ORDER BY 功能名")
            if r["功能名"] in 族们 or (r["父功能"] or "") in 族们]


def _查更新档位(conn, 行):
    s = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (行["供应商"],)).fetchone()
    笔 = _笔记行(conn, 行["供应商"], 行["新模型"])
    档 = 模型档位(s["类型"], s["地址"] or "", 行["新模型"], 笔, s["强度档"] or "")
    if 档["来源"] not in {"接口自报", "不吃这一格"} or 档["过期"]:
        raise 底座错误("新版推理档位未取到，先检查更新后再试")
    if 行["用力"] != 关档 and 行["用力"] not in 档["档们"]:
        raise 底座错误(f"新版不支持 {行['用力']}，请先手动选推理强度")


def 应用模型更新(指纹: str, 选中: list[dict], 库: str | None = None) -> dict:
    p = 模型更新预览(库)
    if not isinstance(指纹, str) or not 指纹 or 指纹 != p["指纹"]:
        raise 底座错误("设置已变化，重新检查更新")
    if not isinstance(选中, list):
        raise 底座错误("请勾选要应用的功能")
    候选 = {r["功能名"]: r for r in p["行"]}
    改们, 已见 = [], set()
    for 项 in 选中:
        if not isinstance(项, dict) or not isinstance(项.get("功能名"), str) or not isinstance(项.get("新模型"), str):
            raise 底座错误("选中行格式不对，请重新选择")
        名, 模 = 项["功能名"], 项["新模型"]
        行 = 候选.get(名)
        if 名 in 已见 or not 行:
            raise 底座错误(f"「{名}」不可重复或已不存在，请重新检查")
        已见.add(名)
        if 行["不提新版"] or 行["状态"] == "拨不动":
            raise 底座错误(f"「{名}」已固定或拨不动，请检查这一行")
        if 模 not in 行["可选模型"]:
            raise 底座错误(f"「{名}」的目标不在可选模型清单，请重新检查")
        if 模 != 行["旧模型"]:
            改们.append(dict(行, 新模型=模))
    if not 改们:
        return {"数量": 0, "改名": {}, "撤回": None}
    for 家, 模 in sorted({(r["供应商"], r["新模型"]) for r in 改们}):
        conn = 连库(库)
        try:
            s = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (家,)).fetchone()
            档 = 模型档位(s["类型"], s["地址"] or "", 模, _笔记行(conn, 家, 模), s["强度档"] or "")
        finally:
            conn.close()
        if 档["来源"] not in {"接口自报", "不吃这一格"} or 档["过期"]:
            try:
                探档位(家, 模, 库=库)
            except 底座错误 as e:
                名 = next(r["功能名"] for r in 改们 if r["供应商"] == 家 and r["新模型"] == 模)
                raise 底座错误(f"「{名}」档位核对未完成，请重新检查：{e}") from e
    conn = 连库(库)
    try:
        conn.execute("BEGIN IMMEDIATE")
        try:
            现 = _换新计划(_更新快照(conn))
            if 现["指纹"] != 指纹:
                raise 底座错误("设置已变化，重新检查更新")
            for 行 in 改们:
                try:
                    _查更新档位(conn, 行)
                except 底座错误 as e:
                    raise 底座错误(f"「{行['功能名']}」：{e}") from e
            族们 = sorted({r["父功能"] or r["功能名"] for r in 改们})
            前 = _更新族快照(conn, 族们)
            for 行 in 改们:
                conn.execute("UPDATE 功能 SET 主用模型=? WHERE 功能名=?", (行["新模型"], 行["功能名"]))
            改名 = {}
            for 头 in 族们:
                改名.update(_名随设定(conn, 头))
            后 = _更新族快照(conn, 族们)
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()
    return {"数量": len(改们), "改名": 改名,
            "撤回": {"族": 族们, "前": 前, "后": 后, "改名": 改名, "数量": len(改们)}}


def 撤回模型更新(回执: dict, 库: str | None = None) -> dict:
    conn = 连库(库)
    try:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if _更新族快照(conn, 回执["族"]) != 回执["后"]:
                raise 底座错误("相关功能已改过，不能撤回")
            for r in 回执["后"]:
                conn.execute("DELETE FROM 功能 WHERE 功能名=?", (r["功能名"],))
            for r in 回执["前"]:
                列 = list(r)
                conn.execute(f"INSERT INTO 功能 ({','.join(列)}) VALUES ({','.join('?' for _ in 列)})",
                             tuple(r[k] for k in 列))
            逆 = {新: 旧 for 旧, 新 in 回执["改名"].items()}
            for 旧 in set(逆) - set(逆.values()):
                conn.execute("UPDATE 日志 SET 功能=? WHERE 功能=?", (逆[旧], 旧))
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()
    return {"数量": 回执["数量"]}


def 设路由(功能名: str, 供应商: str, 模型: str | None = None,
         库: str | None = None, 回执: dict | None = None) -> bool:
    改名: dict = {}
    conn = 连库(库)
    try:
        if conn.execute("SELECT 1 FROM 供应商 WHERE 名=?", (供应商,)).fetchone() is None:
            raise 底座错误(f"供应商表里没有「{供应商}」")
        _拦禁用模型(模型 or "")
        _守机密(conn, 功能名, 供应商, 模型 or "")
        conn.execute("BEGIN IMMEDIATE")
        try:
            if 模型:
                改 = conn.execute(
                    "UPDATE 功能 SET 主用供应商=?, 主用模型=? WHERE 功能名=?",
                    (供应商, 模型, 功能名)).rowcount
            else:
                改 = conn.execute("UPDATE 功能 SET 主用供应商=? WHERE 功能名=?",
                                 (供应商, 功能名)).rowcount
            爹 = conn.execute("SELECT 父功能 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone()
            if 爹 is not None and (爹["父功能"] or ""):
                改名 = _名随设定(conn, 爹["父功能"])
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()
    if 回执 is not None:
        回执["全名"] = 改名.get(功能名, 功能名) if 改 else ""
        回执["改名"] = 改名
    return bool(改)


def 设用力(功能名: str, 用力: str, 库: str | None = None) -> bool:
    用力 = (用力 or "").strip()
    if not 用力:
        raise 底座错误(f"推理强度不能留空 —— 不想让它想就填「{关档}」")
    if not 用力.isascii() and 用力 != 关档:
        raise 底座错误(f"推理强度要填这家原厂认的那个值(比如 low / medium / high),或者「{关档}」;"
                    f"给的是「{用力}」")
    conn = 连库(库)
    try:
        改 = conn.execute("UPDATE 功能 SET 用力=? WHERE 功能名=?", (用力, 功能名)).rowcount
        conn.commit()
    finally:
        conn.close()
    return bool(改)


def 设启用(功能名: str, 开: bool, 库: str | None = None) -> bool:
    conn = 连库(库)
    try:
        改 = conn.execute("UPDATE 功能 SET 启用=? WHERE 功能名=?",
                        (1 if 开 else 0, 功能名)).rowcount
        conn.commit()
    finally:
        conn.close()
    return bool(改)


def 设说明(功能名: str, 说明: str, 库: str | None = None) -> bool:
    return _设一格(功能名, "说明", 说明, 库)


def 设备注(功能名: str, 备注: str, 库: str | None = None) -> bool:
    return _设一格(功能名, "备注", 备注, 库)


def 设项目笔记(项目名: str, 备注: str | None = None, 网址: str | None = None,
          库: str | None = None) -> dict:
    项目名 = (项目名 or "").strip()
    if not 项目名:
        raise 底座错误("要说清楚是哪个项目")
    if 网址 is not None:
        网址 = (网址 or "").strip()
        if 网址 and not re.match(r"^https?://", 网址, re.I):
            raise 底座错误(f"网址要以 http:// 或 https:// 开头,给的是「{网址[:60]}」")
    conn = 连库(库)
    try:
        conn.execute("INSERT OR IGNORE INTO 项目笔记(项目名) VALUES(?)", (项目名,))
        if 备注 is not None:
            conn.execute("UPDATE 项目笔记 SET 备注=? WHERE 项目名=?",
                         ((备注 or "").strip()[:100], 项目名))
        if 网址 is not None:
            conn.execute("UPDATE 项目笔记 SET 网址=? WHERE 项目名=?", (网址[:300], 项目名))
        conn.commit()
        r = conn.execute("SELECT * FROM 项目笔记 WHERE 项目名=?", (项目名,)).fetchone()
    finally:
        conn.close()
    return {"项目名": 项目名, "备注": r["备注"] or "", "网址": r["网址"] or ""}


def 对调设定(甲: str, 乙: str, 库: str | None = None) -> dict:
    甲, 乙 = (甲 or "").strip(), (乙 or "").strip()
    if not 甲 or not 乙 or 甲 == 乙:
        raise 底座错误("要说清楚是哪两行,而且不能是同一行")
    conn = 连库(库)
    try:
        a = conn.execute("SELECT * FROM 功能 WHERE 功能名=?", (甲,)).fetchone()
        b = conn.execute("SELECT * FROM 功能 WHERE 功能名=?", (乙,)).fetchone()
        for 名, 行 in ((甲, a), (乙, b)):
            if 行 is None:
                raise 功能未登记(f"功能表里没有「{名}」")
        if (a["种类"] or "文本") != (b["种类"] or "文本"):
            raise 底座错误("这两行一个要文字一个要图,设定对调过去必然拨不动")
        同族 = ((a["父功能"] or "") == 乙 or (b["父功能"] or "") == 甲
              or ((a["父功能"] or "") and (a["父功能"] or "") == (b["父功能"] or "")))
        if not 同族:
            raise 底座错误("这两行不是同一条功能下的档,不给对调")
        for 行 in (a, b):
            _守机密(conn, 行["功能名"], 行["主用供应商"] or "", 行["主用模型"] or "")
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute("UPDATE 功能 SET 主用供应商=?, 主用模型=?, 用力=? WHERE 功能名=?",
                         (b["主用供应商"], b["主用模型"], b["用力"] or 关档, 甲))
            conn.execute("UPDATE 功能 SET 主用供应商=?, 主用模型=?, 用力=? WHERE 功能名=?",
                         (a["主用供应商"], a["主用模型"], a["用力"] or 关档, 乙))
            改名 = _名随设定(conn, (a["父功能"] or "") or 甲)
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()
    return {"甲": 甲, "乙": 乙,
            "甲现在": f"{b['主用供应商']}/{b['主用模型']}",
            "乙现在": f"{a['主用供应商']}/{a['主用模型']}",
            "甲新名": 改名.get(甲, 甲), "乙新名": 改名.get(乙, 乙), "改名": 改名}


def _族序(conn, 头: str) -> list:
    return [r[0] for r in conn.execute(
        f"SELECT 功能名 FROM 功能 WHERE 功能名=? OR 父功能=? ORDER BY 功能名<>?, {_族内序}",
        (头, 头, 头))]


def 挪一格(功能名: str, 方向: str, 库: str | None = None) -> dict:
    if 方向 not in ("上", "下"):
        raise 底座错误(f"方向只认「上」或「下」,给的是 {方向!r}")
    conn = 连库(库)
    try:
        行 = conn.execute("SELECT 父功能 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone()
        if 行 is None:
            raise 功能未登记(f"功能表里没有「{功能名}」")
        族 = _族序(conn, 行["父功能"] or 功能名)
    finally:
        conn.close()
    i = 族.index(功能名)
    j = i - 1 if 方向 == "上" else i + 1
    if not 0 <= j < len(族):
        raise 底座错误("已经在最上面了" if 方向 == "上" else "已经在最下面了")
    出 = 对调设定(功能名, 族[j], 库=库)
    return {**出, "这一行": 出["甲新名"], "换到": 出["乙新名"]}


def 族(功能名: str, 库: str | None = None) -> list[dict]:
    conn = 连库(库)
    try:
        行 = conn.execute("SELECT 父功能 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone()
        if 行 is None:
            raise 功能未登记(f"功能表里没有「{功能名}」")
        名们 = _族序(conn, 行["父功能"] or 功能名)
        行们 = {r["功能名"]: r for r in conn.execute(
            f"SELECT * FROM 功能 WHERE 功能名 IN ({','.join('?' * len(名们))})", 名们)}
    finally:
        conn.close()
    return [{"功能名": 名, "供应商": 行们[名]["主用供应商"], "模型": 行们[名]["主用模型"],
             "推理强度": 行们[名]["用力"] or 关档, "启用": bool(行们[名]["启用"])} for 名 in 名们]


def _读同时(conn, 名: str) -> int | None:
    行 = conn.execute("SELECT 同时 FROM 功能 WHERE 功能名=?", (_族头(conn, 名),)).fetchone()
    return int(行["同时"]) if 行 is not None and 行["同时"] is not None else None


def 同时几个(功能名: str, 库: str | None = None) -> int | None:
    conn = 连库(库)
    try:
        if conn.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone() is None:
            raise 功能未登记(f"功能表里没有「{功能名}」")
        return _读同时(conn, 功能名)
    finally:
        conn.close()


def 设同时(功能名: str, 数, 库: str | None = None) -> bool:
    if 数 is None or (isinstance(数, str) and not 数.strip()):
        值 = None
    else:
        try:
            值 = int(str(数).strip())
        except ValueError:
            raise 底座错误(f"「同时跑几个」只收整数,给的是「{数}」") from None
        if not 1 <= 值 <= 64:
            raise 底座错误(f"「同时跑几个」只收 1~64,给的是 {值}")
    conn = 连库(库)
    try:
        if conn.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone() is None:
            raise 功能未登记(f"功能表里没有「{功能名}」")
        头 = _族头(conn, 功能名)
        if _读同时(conn, 头) == 值:
            return False
        conn.execute("UPDATE 功能 SET 同时=? WHERE 功能名=?", (值, 头))
        return True
    finally:
        conn.close()


def 历史(功能名: str = "", *, 软件: str = "", 条数: int = 20, 跳过: int = 0,
       库: str | None = None) -> dict:
    功能名, 软件 = (功能名 or "").strip(), (软件 or "").strip()
    if bool(功能名) == bool(软件):
        raise 底座错误("给一个就行:功能名(看这一族)或 软件=(看这个软件),不能都给也不能都空")
    if 软件 and " · " in 软件:
        raise 底座错误(f"软件名是功能名最前面那一截,不带「 · 」;给的是「{软件}」")
    if 条数 < 0 or 跳过 < 0:
        raise 底座错误("条数和跳过数不能是负数")
    conn = 连库(库)
    try:
        if 功能名:
            行 = conn.execute("SELECT 父功能 FROM 功能 WHERE 功能名=?", (功能名,)).fetchone()
            if 行 is None:
                raise 功能未登记(f"功能表里没有「{功能名}」")
            名们 = _族序(conn, 行["父功能"] or 功能名)
            条件, 参 = f"功能 IN ({','.join('?' * len(名们))})", list(名们)
        else:
            条件, 参 = "(功能=? OR substr(功能,1,?)=?)", [软件, len(软件) + 3, 软件 + " · "]
        汇 = conn.execute(f"SELECT COUNT(*), IFNULL(SUM(成没成=1),0) FROM 日志 WHERE {条件}",
                         参).fetchone()
        志 = []
        for r in conn.execute(f"SELECT * FROM 日志 WHERE {条件} ORDER BY rowid DESC LIMIT ? OFFSET ?",
                              参 + [条数, 跳过]):
            志.append({"ID": _编号("RZ", r["号"]), "时刻": r["时刻"], "功能": r["功能"], "用了谁": r["用了谁"], "模型": r["模型"],
                       "成没成": bool(r["成没成"]), "耗时毫秒": r["耗时毫秒"],
                       "报错原文": (r["报错原文"] or "")[:300],
                       "想了": r["想了"], "用力": r["用力"] or ""})
    finally:
        conn.close()
    return {"日志": 志, "调了": 汇[0], "成了": 汇[1]}


def _设一格(功能名: str, 格: str, 值: str, 库: str | None) -> bool:
    assert 格 in ("说明", "备注"), f"只认说明 / 备注这两格,给的是 {格!r}"
    conn = 连库(库)
    try:
        改 = conn.execute(f"UPDATE 功能 SET {格}=? WHERE 功能名=?",
                        ((值 or "").strip()[:300], 功能名)).rowcount
        conn.commit()
    finally:
        conn.close()
    return bool(改)


def _抹密钥(conn, 错: str, 请求密钥: str = "") -> str:
    if not 错:
        return 错
    密钥们 = {(k or "").strip() for (k,) in conn.execute(
        "SELECT 密钥 FROM 供应商 WHERE IFNULL(密钥,'')!=''")}
    密钥们.add((请求密钥 or "").strip())
    for k in sorted(密钥们, key=len, reverse=True):
        if len(k) >= 8:
            错 = 错.replace(k, "<密钥已抹>")
    return re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{8,}", r"\1<密钥已抹>", 错)


def _记日志(conn, 功能, 谁, 模型, 成, 起, 错, 想了=None, 用力=None):
    conn.execute(
        "INSERT INTO 日志(时刻,功能,用了谁,模型,成没成,耗时毫秒,报错原文,想了,用力)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (time.strftime("%Y-%m-%d %H:%M:%S"), 功能, 谁, 模型, int(成),
         int((time.time() - 起) * 1000), _抹密钥(conn, 错), 想了, 用力),
    )
    conn.commit()


def _记余额(conn, 谁: str, 话: str):
    conn.execute("UPDATE 供应商 SET 余额=?, 余额于=? WHERE 名=?",
                 (话, time.strftime("%Y-%m-%d %H:%M:%S"), 谁))
    conn.commit()


def _看():
    conn = 连库()
    print(f"库:{库路径()}\n")
    print("供应商:")
    for r in conn.execute("SELECT * FROM 供应商"):
        钥 = "不用" if r["类型"] == "命令行" else ("已填" if (r["密钥"] or "").strip() else "空")
        闸 = ""
        if r["吃订阅"]:
            闸 = ("  [吃订阅·已开启]" if (r["已同意"] or "").strip()
                  else f"  [吃订阅·还没开启,拨不动 → python3 ai.py 开启 \"{r['名']}\"]")
        print(f"  {r['名']:<12} {r['类型']:<8} 密钥{钥:<4} {r['地址'] or ''}{闸}")
    print("\n功能:")
    for r in conn.execute("SELECT * FROM 功能"):
        要啥 = "文本" if (r["种类"] or "文本") == "文本" else "图像"
        关 = "" if r["启用"] else "  [已关,接入方看不到]"
        劲 = f"  强度={r['用力'] or 关档}"
        密 = "  [敏感内容·只许 Claude]" if r["客户机密"] else ""
        并 = f"  同时={r['同时']}" if r["同时"] is not None else ""
        print(f"  {r['功能名']:<20} [{要啥}] → {r['主用供应商']} / {r['主用模型']}{劲}{关}{密}{并}")
    for v in 机密违规(conn=conn):
        print(f"  ⚠ 违规:「{v['族']}」带敏感内容标,底下「{v['功能名']}」拨的是 {v['供应商']}/{v['模型']}"
              f"(调用时会跳过它,删不删你定)")
    print("\n最近 5 条日志:")
    for r in conn.execute("SELECT * FROM 日志 ORDER BY rowid DESC LIMIT 5"):
        print(f"  {r['时刻']} {r['功能']} {r['用了谁']}/{r['模型']} "
              f"{'成' if r['成没成'] else '败'} {r['耗时毫秒']}ms {r['报错原文'][:60]}")
    conn.close()


_测CL = "测 · 本机命令行"


def _自检铺本机增强(目录: str) -> str:
    路 = os.path.join(目录, "本机增强.json")
    with open(路, "w", encoding="utf-8") as f:
        json.dump({"家们": [{"名": _测CL, "类型": "命令行", "地址": "claude",
                            "备注": "自检用的命令行", "吃订阅": True}]}, f, ensure_ascii=False)
    原 = globals()["本机增强文件"]
    globals()["本机增强文件"] = 路
    return 原


def _自检():
    import tempfile
    增强目录 = tempfile.TemporaryDirectory()
    真增强 = _自检铺本机增强(增强目录.name)
    if os.path.exists(真增强):
        globals()["本机增强文件"] = 真增强
        assert all(条["名"] and 条["地址"] for 条 in 本机增强()), "仓里的本机增强.json 每家都得有名和地址"
        globals()["本机增强文件"] = os.path.join(增强目录.name, "本机增强.json")
    with tempfile.TemporaryDirectory() as d:
        globals()["本机增强文件"] = os.path.join(d, "没有这个文件.json")
        库 = os.path.join(d, "配置.db")
        家们 = 读配置(库=库)["供应商"]
        assert [x["名"] for x in 家们] == ["DeepSeek", *_出厂照名册], f"不带本机增强该只剩填 key 的几家:{家们}"
        assert all(x["类型"] != "命令行" for x in 家们)
        globals()["本机增强文件"] = os.path.join(d, "坏.json")
        for 坏 in ('{"家们": [{"名": "x"}]}', '{"家们": [{"名": "x", "类型": "邮件", "地址": "y"}]}', "{不是 json"):
            with open(本机增强文件, "w", encoding="utf-8") as f:
                f.write(坏)
            try:
                连库(os.path.join(d, "坏.db")).close()
                raise AssertionError(f"本机增强写坏了该报错:{坏}")
            except 底座错误 as e:
                assert "本机增强读不动" in str(e), e
        globals()["本机增强文件"] = os.path.join(增强目录.name, "本机增强.json")
        CL = next(x for x in 读配置(库=os.path.join(d, "增强.db"))["供应商"] if x["名"] == _测CL)
        assert CL["类型"] == "命令行" and CL["吃订阅"] and ",".join(CL["模型们"]) == _CL模型, CL
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "tests"))
    from test_installed_features import run_core
    run_core(sys.modules[__name__])
    with tempfile.TemporaryDirectory() as d:
        库 = os.path.join(d, "配置.db")
        连库(库).close()
        assert "fable" not in _CL模型 and _禁用模型("claude-fable-5-1") and not _禁用模型("opus")
        for 试 in (lambda: 设路由("示例 · 生成", _测CL, "fable", 库=库),
                   lambda: 加功能("试 · fable", "文本", _测CL, "fable", 库=库),
                   lambda: 加备选("示例 · 生成", _测CL, "fable", 库=库),
                   lambda: 设档("示例 · 生成", [f"{_测CL}/fable"], 库=库),
                   lambda: 加供应商("试家", "网页接口", "http://x", "a,claude-fable-5-1", 库=库)):
            try:
                试()
                raise AssertionError("fable 该被拦下")
            except 底座错误 as e:
                assert "fable" in str(e), e
        assert 设路由("示例 · 生成", _测CL, "opus", 库=库)
    with tempfile.TemporaryDirectory() as d:
        库 = os.path.join(d, "配置.db")
        conn = 连库(库)
        assert conn.execute("SELECT COUNT(*) FROM 功能").fetchone()[0] == 2, "默认功能应有 2 行"
        assert conn.execute(
            "SELECT 主用模型 FROM 功能 WHERE 功能名='示例 · 生成'"
        ).fetchone()[0] == "deepseek-flash"
        conn.close()
        连库(库)
        conn = 连库(库)
        assert conn.execute("SELECT COUNT(*) FROM 供应商").fetchone()[0] == 3, \
            "重复建库不许灌重复行(出厂 3 家:DeepSeek / 本机增强那家 + 免费试通的 Groq)"
        for 名 in _出厂照名册:
            条 = 名册一家(名)
            assert 条, f"名册里该有「{名}」—— 出厂库指着它建这一家"
            行 = conn.execute("SELECT * FROM 供应商 WHERE 名=?", (名,)).fetchone()
            assert 行, f"出厂库该带「{名}」这一家"
            assert not 行["密钥"], f"出厂库里「{名}」的密钥必须是空的(一个 key 都不许进安装包)"
            assert 行["地址"] == str(条["地址"]), f"「{名}」的地址该照名册抄,不许在代码里另写一份"
            assert 行["模型们"] == str(条.get("模型们") or "")
            assert 行["最小间隔秒"] == float(条.get("最小间隔秒") or 0)
            assert 行["每小时上限"] == int(条.get("每小时上限") or 0)
            assert bool(行["免费"]) and not 行["吃订阅"], f"「{名}」该是免费、不吃订阅"
            assert 行["注册页"] == str(条.get("注册页") or ""), f"「{名}」该带上去哪领 key 那个链接"
        conn.execute("UPDATE 供应商 SET 地址=?, 最小间隔秒=? WHERE 名=?",
                     ("https://改过的.example/v1/chat/completions", 99.0, _出厂照名册[0]))
        conn.commit(); conn.close()
        conn = 连库(库)
        改 = conn.execute("SELECT 地址,最小间隔秒 FROM 供应商 WHERE 名=?", (_出厂照名册[0],)).fetchone()
        assert 改["地址"] == "https://改过的.example/v1/chat/completions" and 改["最小间隔秒"] == 99.0, \
            "人手改过的网址和节流,下次连库不许被名册盖回去"
        conn.execute("UPDATE 供应商 SET 地址=?, 最小间隔秒=? WHERE 名=?",
                     (str(名册一家(_出厂照名册[0])["地址"]),
                      float(名册一家(_出厂照名册[0]).get("最小间隔秒") or 0), _出厂照名册[0]))
        conn.commit()
        for 名 in ("OpenCode 免费", "智谱开放平台"):
            assert conn.execute("SELECT 1 FROM 供应商 WHERE 名=?", (名,)).fetchone() is None, \
                f"「{名}」已撤出出厂库,新库里不该有它"
        assert 名册一家("OpenCode 免费") is None, "OpenCode 免费档用不了,名册里也不该留着让人挑"
        conn.close()

        一级 = os.path.join(d, "ai-base", "配置.db")
        连库(一级).close()
        assert os.path.exists(一级), "库所在文件夹差最后一级时,要自己补出来"

        深 = os.path.join(d, "打错的", "一层", "配置.db")
        try:
            连库(深)
            raise AssertionError("路径多打一层的时候不许静默建库")
        except 底座错误:
            pass
        assert not os.path.exists(os.path.join(d, "打错的")), "不许顺着打错的路径建目录"

        for 功, 该报, 该类 in [("不存在的功能", "功能表里没有", 功能未登记),
                             ("示例 · 生成", "还没填密钥", 缺配置)]:
            try:
                问(功, "s", "u", 库=库)
                raise AssertionError(f"「{功}」该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"
                assert type(e) is 该类, f"「{功}」该报 {该类.__name__},实得 {type(e).__name__}"
                if 该类 is 缺配置:
                    话 = str(e)
                    assert "「AI接入底座」设置面板" in 话 and 话.index("设置面板") < 话.index("python3"), \
                        f"缺密钥那句得先指面板、命令行排后头:{话}"

        配 = 读配置(库=库)
        生成行 = next(x for x in 配["功能"] if x["功能名"] == "示例 · 生成")
        assert 生成行["拨不动理由"] == "密钥还没填", \
            f"没填密钥时该把原话发给接入方,实得 {生成行.get('拨不动理由')!r}"

        conn = 连库(库)
        conn.execute("UPDATE 供应商 SET 密钥='sk-jiade', 地址='http://127.0.0.1:1/x' WHERE 名='DeepSeek'")
        conn.commit()
        conn.close()
        生成行 = next(x for x in 读配置(库=库)["功能"] if x["功能名"] == "示例 · 生成")
        assert 生成行["拨不动理由"] == "", \
            f"密钥已填且本机条件齐时该发空串,实得 {生成行['拨不动理由']!r}"
        try:
            问("示例 · 生成", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("连不上该抛错")
        except 底座错误:
            pass
        conn = 连库(库)
        败 = conn.execute("SELECT * FROM 日志 WHERE 成没成=0").fetchone()
        assert 败 is not None and 败["功能"] == "示例 · 生成", "失败也得进日志"
        assert 败["报错原文"], "日志得记下报错原文"
        conn.close()

        assert 设限速("查无此家", 1, 1, 库=库) is False, "名字瞎写要报没改到"

        assert 设限速("DeepSeek", 0, 2, 库=库) is True
        conn = 连库(库)
        本来 = conn.execute("SELECT COUNT(*) FROM 日志").fetchone()[0]
        _限速(conn, "DeepSeek")
        _限速(conn, "DeepSeek")
        try:
            _限速(conn, "DeepSeek")
            raise AssertionError("上限设的 2、已经放行 2 次,第三次该被拦下")
        except 底座错误 as e:
            assert "上限" in str(e), f"该报的是撞上限,报的却是:{e}"
        assert conn.execute("SELECT COUNT(*) FROM 发号 WHERE 谁='DeepSeek'").fetchone()[0] == 2, \
            "被拦下的那次不许占号"
        assert conn.execute("SELECT COUNT(*) FROM 日志").fetchone()[0] == 本来, \
            "被限速拦下的那次不许进日志 —— 它根本没发出去"
        conn.close()

        try:
            问("示例 · 生成", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("上限还没过,问() 该被拦下")
        except 底座错误 as e:
            assert "上限" in str(e), f"问() 报的不是撞上限:{e}"

        conn = 连库(库)
        conn.execute("DELETE FROM 发号")
        conn.close()
        assert 设限速("DeepSeek", 1.5, 0, 库=库) is True
        conn = 连库(库)
        _限速(conn, "DeepSeek")
        起时 = time.time()
        _限速(conn, "DeepSeek")
        等了 = time.time() - 起时
        conn.close()
        assert 等了 >= 1.2, f"设了 1.5 秒间隔却只等了 {等了:.2f} 秒"

        conn = 连库(库)
        conn.execute("DELETE FROM 发号")
        conn.close()
        assert 设限速("DeepSeek", 0.6, 0, 库=库) is True
        小工 = (
            "import sys, ai;"
            "c = ai.连库(sys.argv[1]);"
            "ai._限速(c, 'DeepSeek');"
            "c.close()"
        )
        起时 = time.time()
        伙 = [subprocess.Popen([sys.executable, "-c", 小工, 库],
                              cwd=os.path.dirname(os.path.abspath(__file__)),
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
              for _ in range(3)]
        for pp in 伙:
            拿 = pp.communicate(timeout=90)
            assert pp.returncode == 0, f"并发那三个进程有一个挂了:{拿[1].decode('utf-8','replace')[:300]}"
        总共 = time.time() - 起时
        conn = 连库(库)
        号 = [r[0] for r in conn.execute("SELECT 时刻 FROM 发号 WHERE 谁='DeepSeek' ORDER BY 时刻")]
        conn.close()
        assert len(号) == 3, f"三个进程该各占一个号,实际 {len(号)} 个"
        最挤 = min((号[i + 1] - 号[i]) for i in range(len(号) - 1))
        assert 最挤 >= 0.5, (
            f"三个进程一起放行了(最近的两次只隔 {最挤:.2f} 秒,设的是 0.6)—— 跨进程锁没起作用")
        assert 总共 >= 1.2, f"三个进程排队至少要 1.2 秒,实际只用了 {总共:.2f} 秒"
        assert 设限速("DeepSeek", 0, 0, 库=库) is True

        class _假回:
            def __init__(self, 文): self.文 = 文.encode()
            def read(self): return self.文
            def __enter__(self): return self
            def __exit__(self, *a): return False
        原开, 假回们 = urllib.request.urlopen, [
            '{"success":true,"ip":"1.2.3.4","country":"美国","region":"宾夕法尼亚州",'
            '"city":"费城","connection":{"isp":"Verizon"}}',
            "1.2.3.4",
            '{"success":true,"ip":"5.6.7.8","country":"美国"}',
        ]
        收 = []
        try:
            urllib.request.urlopen = lambda *a, **k: _假回(假回们.pop(0))
            for _ in range(3):
                收.append(查出口(库=库, 超时=1))
        finally:
            urllib.request.urlopen = 原开
        assert 收[0]["地"] == "美国 · 宾夕法尼亚州 · 费城", f"归属地拼错了:{收[0]['地']!r}"
        assert 收[0]["运营商"] == "Verizon", f"运营商没读出来:{收[0]['运营商']!r}"
        assert 收[1]["现在"] == "1.2.3.4" and 收[1]["地"] == "", \
            "只回一行 IP 的探针没有归属地,这一格必须是空的,不许编"
        assert 收[2]["地"] == "美国", f"缺省市时只留国家,实得 {收[2]['地']!r}"
        conn = 连库(库)
        地址们 = [r["地址"] for r in conn.execute("SELECT 地址 FROM 出口 ORDER BY rowid")]
        conn.close()
        assert 地址们 == ["1.2.3.4", "5.6.7.8"], f"同一个 IP 只该记一条,实得 {地址们}"
        try:
            urllib.request.urlopen = lambda *a, **k: _假回('{"success":false,"message":"quota"}')
            r失 = 查出口(库=库, 超时=1)
        finally:
            urllib.request.urlopen = 原开
        assert r失["现在"] is None, f"success:false 该当探不到,实得 {r失['现在']!r}"

        加供应商("测 · 订阅家", "网页接口", "http://127.0.0.1:1/v1/chat/completions", "m-订", 库=库)
        设密钥("测 · 订阅家", "sk-dingyue", 库=库)
        加功能("测 · 订阅活", "文本", "测 · 订阅家", "m-订", 库=库)
        那家 = next(x for x in 读配置(库=库)["供应商"] if x["名"] == "测 · 订阅家")
        assert 那家["吃订阅"] and not 那家["已同意"], "本机地址那家该自动标上吃订阅,而且默认没同意过"
        订阅活 = next(x for x in 读配置(库=库)["功能"] if x["功能名"] == "测 · 订阅活")
        assert 订阅活["拨不动理由"] == "还没点过「我知道有账号风险,开启」", \
            f"吃订阅没开启时该把原话发给接入方,实得 {订阅活['拨不动理由']!r}"

        conn = 连库(库)
        本来日志 = conn.execute("SELECT COUNT(*) FROM 日志").fetchone()[0]
        本来发号 = conn.execute("SELECT COUNT(*) FROM 发号").fetchone()[0]
        conn.close()
        try:
            问("测 · 订阅活", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("没点过同意就该被拦下")
        except 底座错误 as e:
            assert "还没开启" in str(e), f"该报「还没开启」,报的却是:{e}"
            assert "面板" in str(e), "拦下的时候得告诉人去哪儿开,不能只说一句不行"
            assert str(e).index("「AI接入底座」设置面板") < str(e).index("python3"), \
                f"装机用户没有 python3:先指面板,命令行排后头:{e}"
            assert type(e) is 缺配置 and "「这一家烧的是订阅额度」的勾去掉" in str(e), \
                f"本机地址被猜成吃订阅时,得告诉人猜错了怎么改:{e}"
        for 远 in ({"名": "测 · 远端订阅", "类型": "网页接口", "地址": "https://example.invalid/v1",
                   "吃订阅": 1, "已同意": None},
                  {"名": "测 · 命令行订阅", "类型": "命令行", "地址": "claude", "吃订阅": 1, "已同意": None}):
            try:
                _要同意(远)
                raise AssertionError(f"{远['名']} 没点过同意也该被拦")
            except 缺配置 as e:
                assert "地址指向本机" not in str(e), f"不是本机网页接口就别补那句:{e}"
        conn = 连库(库)
        assert conn.execute("SELECT COUNT(*) FROM 日志").fetchone()[0] == 本来日志, \
            "被这道闸拦下的那次不许进日志 —— 它根本没发出去"
        assert conn.execute("SELECT COUNT(*) FROM 发号").fetchone()[0] == 本来发号, \
            "被这道闸拦下的那次不许占限速的号"
        conn.close()

        assert 设同意("测 · 订阅家", True, 库=库) is True
        assert next(x for x in 读配置(库=库)["供应商"]
                    if x["名"] == "测 · 订阅家")["已同意"], "同意的那一刻该存下来"
        try:
            问("测 · 订阅活", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("连不上该抛错")
        except 底座错误 as e:
            assert "还没开启" not in str(e), f"已经开启了还被闸挡着:{e}"

        assert 设同意("测 · 订阅家", False, 库=库) is True
        try:
            问("测 · 订阅活", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("关回去之后该又被拦下")
        except 底座错误 as e:
            assert "还没开启" in str(e), f"报错内容不对:{e}"
        assert 设同意("根本没这家", True, 库=库) is False, "名字瞎写要报没改到"

        assert not next(x for x in 读配置(库=库)["供应商"] if x["名"] == "DeepSeek")["吃订阅"]
        try:
            问("示例 · 生成", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("连不上该抛错")
        except 底座错误 as e:
            assert "还没开启" not in str(e), f"按次付费那家不该被这道闸挡下:{e}"

        几 = 开启全部(库=库)
        assert 几 >= 2, f"该把标了吃订阅又没开的全开了(本机增强那家 + 测 · 订阅家),实际开了 {几} 家"
        assert 开启全部(库=库) == 0, "已经全开着了就不该再动它们"
        for 名 in (_测CL, "测 · 订阅家"):
            assert next(x for x in 读配置(库=库)["供应商"]
                        if x["名"] == 名)["已同意"], f"「{名}」该是开着的"

        assert 设吃订阅("测 · 订阅家", False, 库=库) is True
        assert not next(x for x in 读配置(库=库)["供应商"]
                        if x["名"] == "测 · 订阅家")["已同意"], "取消吃订阅该把那句同意一起抹掉"
        assert 设吃订阅("测 · 订阅家", True, 库=库) is True
        assert not next(x for x in 读配置(库=库)["供应商"]
                        if x["名"] == "测 · 订阅家")["已同意"], "标回吃订阅不许把抹掉的同意自动还原"
        try:
            问("测 · 订阅活", "s", "u", 超时=2, 重试=0, 库=库)
            raise AssertionError("同意被抹掉了,该重新被拦下")
        except 底座错误 as e:
            assert "还没开启" in str(e), f"报错内容不对:{e}"

        assert _剥围栏('{"a":1}') == '{"a":1}'
        assert _剥围栏('```json\n{"a":1}\n```') == '{"a":1}'
        assert _剥围栏('好的,这是改稿:\n```json\n{"a":1}\n```\n还有别的话') == '{"a":1}'

        conn = 连库(库)
        conn.execute("INSERT OR REPLACE INTO 供应商(名,类型,地址,密钥) "
                     "VALUES('假命令行','命令行','这个命令不存在-zzz',NULL)")
        conn.execute("INSERT OR REPLACE INTO 功能(功能名,主用供应商,主用模型) "
                     "VALUES('测 · 命令行','假命令行','sonnet')")
        conn.execute("INSERT OR REPLACE INTO 供应商(名,类型,地址) VALUES('怪类型','外星协议','x')")
        conn.execute("INSERT OR REPLACE INTO 功能(功能名,主用供应商,主用模型) "
                     "VALUES('测 · 怪类型','怪类型','x')")
        conn.commit()
        conn.close()
        try:
            问("测 · 命令行", "s", "u", 重试=0, 库=库)
            raise AssertionError("命令不存在该抛错")
        except 底座错误 as e:
            assert "第 2 步" not in str(e), f"命令行不该再报「第 2 步才支持」那句老话:{e}"
            for 坏 in ("UnboundLocalError", "NameError", "TypeError",
                       "AttributeError", "KeyError", "IndexError"):
                assert 坏 not in str(e), f"命令行那条路自己写坏了,不是命令不存在:{e}"
        conn = 连库(库)
        条 = conn.execute("SELECT * FROM 日志 WHERE 功能='测 · 命令行'").fetchone()
        assert 条 is not None and 条["用了谁"] == "假命令行", "命令行调用失败也得进日志"
        conn.close()
        try:
            问("测 · 怪类型", "s", "u", 库=库)
            raise AssertionError("不认识的类型该抛错")
        except 底座错误 as e:
            assert "不认识" in str(e), f"报错内容不对:{e}"

        设密钥("DeepSeek", "sk-panel-cunde", 库=库)
        配 = 读配置(库=库)
        钥 = json.dumps(配, ensure_ascii=False)
        assert "sk-panel-cunde" not in 钥, "密钥原文绝不许出库 —— 面板只该拿到「填没填」"
        DS = next(x for x in 配["供应商"] if x["名"] == "DeepSeek")
        assert DS["有密钥"] and DS["要密钥"], "DeepSeek 该是「要 key 且已填」"
        assert DS["模型们"] == ["deepseek-flash", "deepseek-v4-pro"], f"模型清单该灌进来了,且不带已下线的旧名:{DS['模型们']!r}"
        CL = next(x for x in 配["供应商"] if x["名"] == _测CL)
        assert not CL["要密钥"], "命令行那家不该要 key"
        assert 本机可用("命令行", "这个命令不存在-zzz") is False, "本机没有的命令该判不可用"
        assert 本机可用("网页接口", "") is True, "网页接口那家不看本机装没装"
        旧环境 = {k: os.environ.get(k) for k in ("HOME", "PATH")}
        with tempfile.TemporaryDirectory() as 假家:
            假命令 = os.path.join(假家, ".local", "bin", "假claude-zzz")
            os.makedirs(os.path.dirname(假命令))
            with open(假命令, "w") as f:
                f.write("#!/bin/sh\n")
            os.chmod(假命令, 0o755)
            try:
                os.environ["HOME"] = 假家
                os.environ["PATH"] = os.pathsep.join(
                    d for d in (旧环境["PATH"] or "").split(os.pathsep)
                    if d != os.path.join(os.path.expanduser("~"), ".local", "bin"))
                assert 本机可用("命令行", "假claude-zzz") is True, \
                    "装在 ~/.local/bin、PATH 里没有那一格,也该判本机有"
                assert _找命令("假claude-zzz") == 假命令, \
                    f"真发该用 ~/.local/bin 那个,现在找到的是「{_找命令('假claude-zzz')}」"
                os.remove(假命令)
                assert 本机可用("命令行", "假claude-zzz") is False, "~/.local/bin 里也没有,就该判没装"
            finally:
                for k, v in 旧环境.items():
                    if v is None:
                        os.environ.pop(k, None)
                    else:
                        os.environ[k] = v
        assert 设路由("示例 · 生成", _测CL, "sonnet", 库=库), "换供应商该改得动"
        assert next(x for x in 读配置(库=库)["功能"]
                    if x["功能名"] == "示例 · 生成")["主用模型"] == "sonnet", "换完该读得回来"
        assert not 设密钥("根本没这家", "x", 库=库), "名字瞎写该返回 False"
        try:
            设密钥("DeepSeek", "sk-带个,逗号", 库=库)
            raise AssertionError("非英文字符的密钥该被挡下")
        except 底座错误 as e:
            assert "不是英文数字" in str(e), f"报错内容不对:{e}"
        conn = 连库(库)
        assert conn.execute("SELECT 密钥 FROM 供应商 WHERE 名='DeepSeek'").fetchone()[0] \
            == "sk-panel-cunde", "挡下的那次不许把原来存着的密钥改掉"
        conn.close()
        assert not 设路由("根本没这个功能", "DeepSeek", 库=库), "功能瞎写该返回 False"
        try:
            设路由("示例 · 生成", "根本没这家", 库=库)
            raise AssertionError("指向不存在的供应商该抛错")
        except 底座错误:
            pass

        assert 加供应商("测 · 新家", "网页接口", "http://127.0.0.1:1/v1/chat/completions",
                     "m-一,m-二", "自检加的", 库=库) == "新建", "第一次加该报「新建」"
        新 = next(x for x in 读配置(库=库)["供应商"] if x["名"] == "测 · 新家")
        assert 新["要密钥"] and not 新["有密钥"], "新加的网页接口那家该是「要 key 且还没填」"
        assert 新["模型们"] == ["m-一", "m-二"], f"模型清单该拆成两个:{新['模型们']}"
        assert 设路由("示例 · 润色", "测 · 新家", "m-一", 库=库), "新加的这家该能被功能拨过去"
        设密钥("测 · 新家", "sk-biemowo", 库=库)
        assert 加供应商("测 · 新家", "网页接口", "http://127.0.0.1:2/v1/chat/completions",
                     库=库) == "改了", "重名该报「改了」而不是新建一行"
        conn = 连库(库)
        那 = conn.execute("SELECT * FROM 供应商 WHERE 名='测 · 新家'").fetchone()
        conn.close()
        assert 那["地址"].endswith(":2/v1/chat/completions"), "改那一支该把网址改过来"
        assert 那["密钥"] == "sk-biemowo", "改网址不许把已存的密钥抹掉"
        assert 那["模型们"] == "m-一,m-二", "模型清单留空 = 不改,不许抹"
        assert (那["最小间隔秒"], 那["每小时上限"]) == _新家默认节流, \
            f"新加一家该带上默认节流 {_新家默认节流},拿到的是 {(那['最小间隔秒'], 那['每小时上限'])}"
        设限速("测 · 新家", 0, 0, 库=库)
        加供应商("测 · 新家", "网页接口", "http://127.0.0.1:3/v1/chat/completions", 库=库)
        conn = 连库(库)
        又 = conn.execute("SELECT 最小间隔秒, 每小时上限 FROM 供应商 WHERE 名='测 · 新家'").fetchone()
        conn.close()
        assert (又["最小间隔秒"], 又["每小时上限"]) == (0, 0), "改一家已有的不许把人手调过的节流冲回默认"
        assert len([x for x in 读配置(库=库)["供应商"] if x["名"] == "测 · 新家"]) == 1, "重名不许多出一行"
        加供应商("测 · 逗号", "网页接口", "http://127.0.0.1:1/x", "甲,乙，丙", 库=库)
        assert next(x for x in 读配置(库=库)["供应商"]
                    if x["名"] == "测 · 逗号")["模型们"] == ["甲", "乙", "丙"], "中英文逗号都该收"

        import io
        设密钥("测 · 逗号", "sk-" "abcdefghijklmnop", 库=库)
        conn = 连库(库)
        _记日志(conn, "测 · 抹密钥", "测 · 逗号", "m", False, time.time(),
              "HTTP 401: {'headers': {'Authorization': 'Bearer sk-" "abcdefghijklmnop'}}")
        conn.close()
        那条 = next(r for r in 读配置(库=库, 日志条数=50)["日志"] if r["功能"] == "测 · 抹密钥")
        assert "sk-" "abcdefghijklmnop" not in 那条["报错原文"], "密钥不许原样落进日志表"
        assert "<密钥已抹>" in 那条["报错原文"], "抹了得留个记号,不然人看不出这儿本来有东西"
        设密钥("测 · 逗号", "abc", 库=库)
        conn = 连库(库)
        _记日志(conn, "测 · 短密钥", "测 · 逗号", "m", False, time.time(), "abc 是报错里的普通字")
        conn.close()
        那条 = next(r for r in 读配置(库=库, 日志条数=50)["日志"] if r["功能"] == "测 · 短密钥")
        assert 那条["报错原文"] == "abc 是报错里的普通字", "短串不许拿去做全文替换"

        def 假HTTP(码):
            return urllib.error.HTTPError("http://x", 码, "", {}, io.BytesIO(b"body"))
        assert not _值得重试(假HTTP(401)), "key 不对,再打一次还是同一个答案"
        assert not _值得重试(假HTTP(400)), "载荷或模型名不对,再打一次还是同一个答案"
        assert not _值得重试(假HTTP(404)), "地址写错,再打一次还是同一个答案"
        assert _值得重试(假HTTP(429)), "限流该重试"
        assert _值得重试(假HTTP(503)), "上游自己出毛病该重试"
        assert _值得重试(urllib.error.URLError("装作连不上")), "根本没连上该重试"
        assert not _值得重试(底座错误("功能表里没这个功能")), "底座自己抛的错不该重试"

        超 = subprocess.TimeoutExpired(["claude", "-p", "x"], 180)
        话 = _超时怪谁(超, "high")
        assert "high" in 话 and 关档 in 话 and "180" in 话, f"超时该指出是推理强度害的:{话}"
        assert "推理强度" in 话 and "面板" in 话, f"得说人话、告诉人去哪改:{话}"
        assert _超时怪谁(超, 关档) == "", "本来就没让它想,超时是别的原因,不许乱指"
        assert _超时怪谁(超, None) == "", "没设过强度 = 出厂的关档,同样不许乱指"
        assert _超时怪谁(假HTTP(504), "high") == "", "网页接口那条路的超时不归这句管"
        assert _值得重试(超), "超时照旧该重试 —— 这一句只改报错的说法,不许动降级行为"

        for 谁 in (问, 画图):
            默认 = inspect.signature(谁).parameters["超时"].default
            assert 默认 >= 180, f"{谁.__name__}() 的默认超时缩到了 {默认} 秒,真调最长那次 129.6 秒"

        原限速, 次数 = _限速, []
        def 数一次(conn, 谁):
            次数.append(谁)
        for 名, 发一次, 该几次 in (
                ("测 · 重试要限速", lambda: (_ for _ in ()).throw(urllib.error.URLError("连不上")), 2),
                ("测 · 401只发一次", lambda: (_ for _ in ()).throw(假HTTP(401)), 1)):
            次数.clear()
            globals()["_限速"] = 数一次
            try:
                conn = 连库(库)
                try:
                    _跑(conn, 名, "测 · 逗号", "m", 发一次, 重试=1)
                except 底座错误:
                    pass
                conn.close()
            finally:
                globals()["_限速"] = 原限速
            assert len(次数) == 该几次, f"{名}:该限速 {该几次} 次,实得 {len(次数)} 次"

        恢复句 = "Your quota will reset after 44h34m7s."
        短体 = ('{"error":{"code":429,"message":"' + "You exceeded your current quota. " * 12
                + 恢复句 + ' Authorization: Bearer sk-' 'live-12345678abcdefgh"}}')
        长体 = '{"error":{"code":429,"message":"' + "x" * 5000 + 恢复句 + '"}}'
        assert 400 < len(短体) < 2000, f"短体得是 400 多字:{len(短体)}"
        原睡 = time.sleep
        for 重, 体, 该睡 in ((0, 短体, 0), (1, 短体, 1), (2, 长体, 2)):
            睡过: list = []
            打了: list = []

            def 回429(体=体):
                打了.append(1)
                raise urllib.error.HTTPError("http://x", 429, "Too Many Requests", {},
                                             io.BytesIO(体.encode("utf-8")))
            globals()["_限速"] = 数一次
            time.sleep = lambda 秒: 睡过.append(秒)
            conn = 连库(库)
            try:
                _跑(conn, "测 · 429 等不等", "测 · 逗号", "m", 回429, 重试=重)
                raise AssertionError("回 429 该抛错")
            except 底座错误 as e:
                错话 = str(e)
            finally:
                time.sleep, globals()["_限速"] = 原睡, 原限速
            入库 = conn.execute("SELECT 报错原文 FROM 日志 WHERE 功能='测 · 429 等不等' "
                              "ORDER BY rowid DESC LIMIT 1").fetchone()[0]
            conn.close()
            assert len(打了) == 重 + 1, f"重试={重} 该打 {重 + 1} 趟,实得 {len(打了)} 趟"
            assert len(睡过) == 该睡, \
                f"重试={重}:429 只在后面还有下一趟时才等,该等 {该睡} 次,实得 {len(睡过)} 次"
            assert 恢复句 in 错话, f"抛出来的错得带着末尾那句恢复时刻,实得末尾:{错话[-120:]}"
            assert 恢复句 in 入库, f"日志里也得留着那句,实得末尾:{入库[-120:]}"
            assert "sk-" "live-12345678abcdefgh" not in 入库, "放长之后照旧得先过 _抹密钥 再入库"
        assert len(入库) < len(长体), "超长的响应体照旧得截短,别整份塞进日志"
        assert _校JSON('```json\n{"a":1}\n```') == '{"a":1}', "网页那支回的围栏也得剥掉"
        try:
            _校JSON("这不是 JSON")
            raise AssertionError("回来的不是 JSON,该当场挑出来")
        except 答非所问:
            pass
        assert _值得重试(答非所问("要的是 JSON")), "模型这次没按格式回,再问一次多半就好"

        加功能("测 · 要JSON", "文本", "DeepSeek", "m", 库=库)
        原发网页, 发了 = _发网页请求, []

        def 假网页(回什么):
            def 发(*a, **k):
                发了.append(1)
                return 回什么
            return 发
        try:
            globals()["_发网页请求"] = 假网页('```json\n{坏了\n```')
            try:
                问("测 · 要JSON", "s", "u", 要JSON=True, 重试=1, 库=库)
                raise AssertionError("回来的不是 JSON,该抛错")
            except 底座错误 as e:
                assert "要的是 JSON" in str(e), f"报错内容不对:{e}"
            assert len(发了) == 2, f"坏 JSON 该重试一次(共发 2 次),实得 {len(发了)} 次"
            那条 = next(r for r in 读配置(库=库, 日志条数=50)["日志"]
                       if r["功能"] == "测 · 要JSON")
            assert 那条["成没成"] == 0, "回来的不是 JSON,日志不许记成「成了」"
            globals()["_发网页请求"] = 假网页('好的:\n```json\n{"标题":"甲"}\n```')
            assert 问JSON("测 · 要JSON", "s", "u", 库=库) == {"标题": "甲"}, \
                "网页那支带围栏的 JSON 也得剥干净还能 parse"
            原命令行 = _发命令行请求
            globals()["_发命令行请求"] = lambda *a, **k: '```json\n{"标题":"乙"}\n```'
            try:
                assert 问JSON("测 · 命令行", "s", "u", 库=库) == {"标题": "乙"}, \
                    "命令行那支的围栏也得剥 —— 两条路共用 问() 里那一处校验"
            finally:
                globals()["_发命令行请求"] = 原命令行
        finally:
            globals()["_发网页请求"] = 原发网页
        删功能("测 · 要JSON", 库=库)

        加供应商("测 · 新命令行", "命令行", "这个命令不存在-zzz", 库=库)
        assert not next(x for x in 读配置(库=库)["供应商"]
                        if x["名"] == "测 · 新命令行")["本机可用"], "本机没有的命令该判不可用"
        for 名, 类, 址, 该报 in [("", "网页接口", "http://x", "起个名"),
                              ("测 · 坏", "外星协议", "http://x", "类型只能是"),
                              ("测 · 坏", "网页接口", "  ", "不能空")]:
            try:
                加供应商(名, 类, 址, 库=库)
                raise AssertionError(f"({名},{类},{址!r}) 该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"
        conn = 连库(库)
        assert conn.execute("SELECT COUNT(*) FROM 供应商 WHERE 名='测 · 坏'").fetchone()[0] == 0, \
            "参数不合格时不许留下半拉行"
        conn.close()

        假图 = b"\x89PNG\r\n\x1a\n" + "假图片字节".encode("utf-8")
        assert _取图({"data": [{"b64_json": base64.b64encode(假图).decode()}]}, 5) == (假图, "image/png"), \
            "OpenAI 那套一个字不报格式,得扒文件头认出这是 PNG"
        try:
            _取图({"data": [{"b64_json": base64.b64encode("这不是图".encode("utf-8")).decode()}]}, 5)
            raise AssertionError("认不出的别瞎猜成 png,也别当成功交出去")
        except 答非所问:
            pass
        assert _取图({"candidates": [{"content": {"parts": [
            {"inlineData": {"mimeType": "image/jpeg",
                            "data": base64.b64encode(假图).decode()}}]}}]}, 5) == (假图, "image/jpeg"), \
            "接口自己报了格式就信它,别扒文件头"
        CF码 = base64.b64encode(假图).decode()
        assert _取图({"success": True, "result": {"image": CF码}}, 5) == (假图, "image/png"), \
            "Cloudflare v4 外包那层的 result.image 得解得出来"
        assert _取图({"image": CF码}, 5) == (假图, "image/png"), \
            "Cloudflare 顶层 image 得解得出来"
        try:
            _取图({"success": False, "errors": [{"code": 1001, "message": "账户无权使用这个模型"}]}, 5)
            raise AssertionError("Cloudflare success=false 该当场报错")
        except 底座错误 as e:
            assert "账户无权使用这个模型" in str(e), f"Cloudflare 报错得带 errors 里的原话:{e}"
        硅图 = os.path.join(d, "硅基假图.png")
        with open(硅图, "wb") as 写:
            写.write(假图)
        assert _取图({"images": [{"url": "file://" + 硅图}], "seed": 1}, 5) == (假图, "image/png"), \
            "硅基那套:图在 images[0].url,得拉下来交出字节"
        def _聊天回包(内联, 话=None):
            return {"choices": [{"message": {"content": 话, "images": [
                {"type": "image_url", "image_url": {"url": 内联}}]}}]}
        码 = base64.b64encode(假图).decode()
        assert _取图(_聊天回包(f"data:image/png;base64,{码}"), 5) == (假图, "image/png"), \
            "聊天口那套:图藏在 choices[0].message.images[0].image_url.url,得解得出来"
        assert _取图(_聊天回包(f"data:;base64,{码}"), 5)[1] == "image/png", \
            "内联网址那头没报格式(或报了个不是 image/ 的),该退回扒文件头"
        try:
            _取图({"choices": [{"message": {"content": "这个我画不了,换一句试试?"}}]}, 5)
            raise AssertionError("聊天口只回文字没出图,该当场报错")
        except 底座错误 as e:
            assert "只回了文字" in str(e) and "画不了" in str(e), \
                f"报错得说清是聊天口这条路、还得带上它的原话:{e}"

        for 体, 该报 in [({"data": [{}]}, "既没有图片"), ({}, "既没有图片"),
                        ({"data": []}, "既没有图片")]:
            try:
                _取图(体, 5)
                raise AssertionError(f"{体} 该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"

        for 尺寸, 该是 in [("1024x1024", "1:1"), ("1000x1000", "1:1"), ("1408x768", "16:9"),
                          ("1920x1080", "16:9"), ("768x1408", "9:16"), ("1024x768", "4:3"),
                          ("768x1024", "3:4"), ("1024×1024", "1:1"),
                          ("1152x896", "5:4"), ("896x1152", "4:5")]:
            assert _算比例(尺寸) == 该是, f"{尺寸} 该算成 {该是},算成了 {_算比例(尺寸)}"
        for 坏 in ("", "大一点", "1024", "0x100", "1024*768"):
            try:
                _算比例(坏)
                raise AssertionError(f"尺寸「{坏}」写得不对,该报错却没报")
            except 底座错误 as e:
                assert "宽x高" in str(e) or "大于 0" in str(e), f"报错内容不对:{e}"

        佳 = "http://没这台机器/v1beta/models/{模型}:generateContent"
        网址, 载荷, 内容类型佳 = _拼生图请求(佳, "假模型", "一只猫", "1024x1024")
        assert 网址 == "http://没这台机器/v1beta/models/假模型:generateContent", "模型名该填进网址里"
        assert 内容类型佳 == "application/json", "Gemini 没参考图照旧发 JSON"
        assert 载荷["generationConfig"]["imageConfig"]["aspectRatio"] == "1:1", \
            f"比例没进 Gemini 那套的载荷里:{json.dumps(载荷, ensure_ascii=False)}"
        assert _拼生图请求(佳, "假模型", "一只猫", "1408x768")[1] \
            ["generationConfig"]["imageConfig"]["aspectRatio"] == "16:9", "换个尺寸比例也得跟着换"
        网址二, 载荷二, 内容类型二 = _拼生图请求(
            "http://没这台机器/v1/images/generations", "假模型", "一只猫", "1024x1024")
        assert 网址二 == "http://没这台机器/v1/images/generations", "OpenAI 那条的网址不该被动"
        assert 载荷二 == {"model": "假模型", "prompt": "一只猫", "n": 1, "size": "1024x1024"}, \
            f"OpenAI 那条的载荷不该被动:{json.dumps(载荷二, ensure_ascii=False)}"
        assert 内容类型二 == "application/json", "OpenAI 没参考图时还得走原来的 JSON"

        CF址 = "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run"
        网址CF, 载荷CF, 类型CF = _拼生图请求(
            CF址, "@cf/black-forest-labs/flux-1-schnell", "一只猫", "2048x1024")
        assert 网址CF == (CF址 + "/@cf/black-forest-labs/flux-1-schnell"), \
            f"Cloudflare 模型名该拼进 /ai/run 后面:{网址CF}"
        assert 载荷CF == {"prompt": "一只猫"}, f"Cloudflare 请求体只能有 prompt:{载荷CF}"
        assert 类型CF == "application/json", "Cloudflare 生图发 JSON"
        try:
            _拼生图请求(CF址, "@cf/black-forest-labs/flux-1-schnell", "词", "1024x1024", [假图])
            raise AssertionError("Cloudflare 生图给了参考图该当场报错")
        except 底座错误 as e:
            assert "不吃参考图" in str(e), f"Cloudflare 参考图报错得说清原因:{e}"

        聊 = "http://没这台机器/v1/chat/completions"
        网址三, 载荷三, 内容类型三 = _拼生图请求(聊, "假模型", "一只猫", "1024x1536")
        assert 网址三 == 聊, "聊天口那条的网址不该被动"
        assert 内容类型三 == "application/json", "聊天口照旧发 JSON"
        assert 载荷三["model"] == "假模型" and "size" not in 载荷三, \
            f"聊天口那套的模型名在请求体里,而且没有 size 这一格:{json.dumps(载荷三, ensure_ascii=False)}"
        那句 = 载荷三["messages"][0]["content"]
        assert 那句.startswith("一只猫") and "1024x1536" in 那句, \
            f"提示词该原样打头,尺寸跟在后面(这条路只有这一个通道能说尺寸):{那句!r}"
        assert "1408x768" in _拼生图请求(聊, "假模型", "猫", "1408x768")[1]["messages"][0]["content"], \
            "换个尺寸,话里那句也得跟着换"
        try:
            _拼生图请求(聊, "假模型", "猫", "大一点")
            raise AssertionError("尺寸写得不对,聊天口那条也该报错")
        except 底座错误 as e:
            assert "宽x高" in str(e), f"报错内容不对:{e}"
        assert "messages" in _拼生图请求(聊 + "/", "假模型", "猫", "1024x1024")[1], \
            "地址末尾多个斜杠也得认出是聊天口那套"

        小红 = b"\x89PNG\r\n\x1a\n" + "随便什么内容,认格式只看头八个字节".encode()
        小图二 = b"\xff\xd8\xff" + "jpg 的头就这三个字节".encode()
        _, 带图, _ = _拼生图请求(佳, "假模型", "换成蓝的", "1024x1024", [小红, 小图二])
        片们 = 带图["contents"][0]["parts"]
        assert len(片们) == 3 and 片们[0] == {"text": "换成蓝的"}, \
            f"提示词该还在第一片,参考图排在它后面:{[list(x) for x in 片们]}"
        assert [x["inlineData"]["mimeType"] for x in 片们[1:]] == ["image/png", "image/jpeg"], \
            "格式该由底座扒文件头认出来,不该让调用方报"
        assert base64.b64decode(片们[1]["inlineData"]["data"]) == 小红, "递进去的字节该原样到达"
        assert len(_拼生图请求(佳, "假模型", "词", "1024x1024", 小红)[1]
                  ["contents"][0]["parts"]) == 2, "单张 bytes 该当成一张图,不是一堆字节"
        assert _拼生图请求(佳, "假模型", "一只猫", "1024x1024")[1]["contents"] \
            == [{"parts": [{"text": "一只猫"}]}], "不给参考图时 Gemini 那条载荷不该有多余的片"
        网址四, 表单, 内容类型 = _拼生图请求(
            "http://没这台机器/v1/images/generations", "假模型", "换成蓝的", "1024x1024",
            [小红, 小图二])
        assert 网址四 == "http://没这台机器/v1/images/edits", f"有参考图该改打 edits:{网址四}"
        assert isinstance(表单, bytes), f"multipart 载荷该是字节,拿到的是 {type(表单).__name__}"
        assert 内容类型.startswith("multipart/form-data; boundary="), \
            f"Content-Type 里该带 boundary:{内容类型}"
        界 = 内容类型.split("boundary=", 1)[1]
        assert 表单.startswith(f"--{界}\r\n".encode()) and 表单.endswith(f"--{界}--\r\n".encode()), \
            "multipart 正文的首尾 boundary 不对"
        for 名, 值 in (("model", "假模型"), ("prompt", "换成蓝的"), ("size", "1024x1024")):
            该片 = f'name="{名}"\r\n\r\n{值}\r\n'.encode()
            assert 该片 in 表单, f"multipart 里少了原样的 {名} 字段"
        assert 表单.count(b'name="image[]"') == 2, "多张参考图该产生两个重复的 image[] 字段"
        assert 小红 in 表单 and 小图二 in 表单, "两张参考图的原始字节都得进 multipart"
        _, 单图表单, _ = _拼生图请求(
            "http://没这台机器/v1/images/generations", "假模型", "词", "1024x1024", 小红)
        assert b'name="image"' in 单图表单 and b'name="image[]"' not in 单图表单, \
            "单张参考图该用 image 字段,只有多张才改成重复的 image[]"

        收到的请求 = {}
        class _假生图回:
            def __enter__(self): return self
            def __exit__(self, *a): pass
            def read(self):
                return json.dumps({"data": [{"b64_json": base64.b64encode(小红).decode()}]}).encode()
        原开 = urllib.request.urlopen
        try:
            def _收请求(请求, **kw):
                收到的请求["请求"] = 请求
                收到的请求["参数"] = kw
                return _假生图回()
            urllib.request.urlopen = _收请求
            assert _发生图请求(网址四, "sk-这是假密钥", 表单, 内容类型, 5) == (小红, "image/png")
        finally:
            urllib.request.urlopen = 原开
        发出的 = 收到的请求["请求"]
        assert 发出的.data == 表单, "multipart 字节不许再套 JSON 或改写"
        assert 发出的.get_header("Content-type") == 内容类型, "multipart 的 Content-Type 得带原 boundary"
        assert 发出的.get_header("User-agent") == _UA, "multipart 请求也必须带现有的 _UA"
        try:
            _拼生图请求("http://没这台机器/v1/chat/completions", "假模型", "词", "1024x1024", [小红])
            raise AssertionError("聊天口那条给了参考图该当场报错,不许没实测就闷头发出去")
        except 底座错误 as e:
            assert "没开图生图" in str(e) and "{模型}" in str(e), f"报错得说清出路:{e}"
        硅址 = "https://api.siliconflow.cn/v1/images/generations"
        网址硅, 载荷硅, 类型硅 = _拼生图请求(硅址, "Kwai-Kolors/Kolors", "一只猫", "1024x768")
        assert 网址硅 == 硅址 and 类型硅 == "application/json", "硅基那条网址原样打、发 JSON"
        assert 载荷硅 == {"model": "Kwai-Kolors/Kolors", "prompt": "一只猫",
                        "image_size": "1024x768", "batch_size": 1}, f"硅基请求体不对:{载荷硅}"
        assert _拼生图请求("http://127.0.0.1:8317/v1/images/generations", "m", "猫", "1024x1024")[1] \
            == {"model": "m", "prompt": "猫", "n": 1, "size": "1024x1024"}, "别家 OpenAI 那条的请求体一个字都不许变"
        assert _拼生图请求("http://127.0.0.1:8317/v1/images/generations", "gpt-image-2", "猫", "1024x1024")[1] \
            == {"model": "gpt-image-2", "prompt": "猫", "n": 1, "size": "1024x1024",
                "background": "opaque"}, "gpt-image 系文生图该带 background=opaque"
        _, 不透明表单, _ = _拼生图请求(
            "http://没这台机器/v1/images/generations", "GPT-Image-2", "词", "1024x1024", 小红)
        assert b'name="background"\r\n\r\nopaque\r\n' in 不透明表单, "gpt-image 系图生图 multipart 也得带 background=opaque"
        assert b'name="background"' not in 单图表单 and b'name="background"' not in 表单, \
            "非 gpt-image 模型的 multipart 不许带 background"
        assert "background" not in _拼生图请求(硅址, "gpt-image-2", "猫", "1024x1024")[1], \
            "background 只补在 OpenAI 那条路上,硅基那套不认"
        try:
            _拼生图请求(硅址, "m", "词", "1024x1024", [小红])
            raise AssertionError("硅基那条给了参考图该当场报错")
        except 底座错误 as e:
            assert "没开图生图" in str(e), f"报错得说清:{e}"

        for 址, 该是, 该吃 in [
                ("http://127.0.0.1:8317/v1beta/models/{模型}:generateContent", 路子_GEMINI, True),
                ("http://127.0.0.1:8317/v1/images/generations", 路子_OPENAI, True),
                ("http://127.0.0.1:8317/v1/chat/completions", 路子_聊天口, False),
                ("https://api.siliconflow.cn/v1/images/generations", 路子_硅基, False),
                ("https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run", 路子_CF, False)]:
            assert 生图路子(址) == 该是, f"「{址}」该判成 {该是},判成了 {生图路子(址)}"
            assert 吃参考图吗(址) is 该吃, f"「{址}」吃不吃参考图该是 {该吃}"
        assert 生图路子("https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions") is None, \
            "Cloudflare 文本口不许判成生图"
        try:
            _拼生图请求("https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
                     "@cf/meta/llama-3.1-8b-instruct", "猫", "1024x1024")
            raise AssertionError("Cloudflare 文本口不许落进 OpenAI 生图兜底")
        except 底座错误 as e:
            assert "不是生图地址" in str(e), f"Cloudflare 文本口的报错不对:{e}"
        assert 生图路子("  http://x/v1/chat/completions/  ") == 路子_聊天口, "末尾斜杠不该改判"
        assert 生图路子("") is None and 吃参考图吗("") is None, \
            "地址空着该回 None(说不上来),不许当成「不能」——当成不能会让面板把好模型也灰掉"
        assert 生图路子(None) is None, "地址是 None 也得稳住,别炸在面板那一头"
        源 = inspect.getsource(_拼生图请求)
        assert "生图路子(地址)" in 源, "_拼生图请求 该调 生图路子(),别自己再判一遍"
        for 抄回来的 in ('"{模型}" in 地址', 'endswith("/chat/completions")'):
            assert 抄回来的 not in 源, \
                f"_拼生图请求 里又出现了 `{抄回来的}` —— 判据长回两份了,挪回 生图路子() 里去"
        try:
            _塞图("这不是图片,是一段中文".encode())
            raise AssertionError("不是图片该拦下来")
        except 底座错误 as e:
            assert "认得出的图片" in str(e), f"报错内容不对:{e}"

        assert _拼话("看看这个", []) == "看看这个", "不递图时 content 该照旧是那个字符串,不许摊成数组"
        片 = _拼话("这是什么颜色", [小红, 小图二])
        assert len(片) == 3 and 片[0] == {"type": "text", "text": "这是什么颜色"}, \
            f"问题该还在第一片,图排在它后面:{片}"
        网址们 = [x["image_url"]["url"] for x in 片[1:]]
        assert 网址们[0].startswith("data:image/png;base64,") \
            and 网址们[1].startswith("data:image/jpeg;base64,"), \
            f"格式该由底座扒文件头认出来,不该让调用方报:{[x[:28] for x in 网址们]}"
        assert base64.b64decode(网址们[0].split(",", 1)[1]) == 小红, "递进去的字节该原样到达"
        assert len(_拼话("词", _几张(小红))) == 2, "单张 bytes 该当成一张图,不是一堆字节"
        命行 = _拼命令行话("这是什么颜色", [小红, 小图二])
        assert 命行.endswith("\n") and 命行.count("\n") == 1, "stream-json 一条消息占一行"
        assert 命行.isascii(), "整行得是纯 ASCII —— Windows 上按本地编码写 stdin 才写不坏中文"
        命 = json.loads(命行)
        assert 命["type"] == "user" and 命["message"]["role"] == "user", f"外壳不对:{命行[:80]}"
        命片 = 命["message"]["content"]
        assert 命片[0] == {"type": "text", "text": "这是什么颜色"}, f"问题该在第一片:{命片[0]}"
        assert [x["source"]["media_type"] for x in 命片[1:]] == ["image/png", "image/jpeg"], \
            "格式该由底座扒文件头认出来"
        assert base64.b64decode(命片[1]["source"]["data"]) == 小红, "递进去的字节该原样到达"
        assert _取信封(json.dumps({"type": "result", "result": "甲"}))["result"] == "甲"
        assert _取信封('{"type":"system"}\n{"type":"assistant"}\n{"type":"result","result":"乙"}\n')["result"] == "乙", \
            "stream-json 该挑出 result 那一行"
        assert _取信封("乱七八糟") is None and _取信封("") is None, "认不出的回 None"
        try:
            _塞图问("这不是图片,是一段中文".encode())
            raise AssertionError("不是图片该拦下来(问() 这条路同理)")
        except 底座错误 as e:
            assert "认得出的图片" in str(e), f"报错内容不对:{e}"

        加供应商("测 · 看图家", "网页接口", "https://api.example.com/v1/chat/completions",
              "看图模型", 库=库)
        设密钥("测 · 看图家", "sk-kantu", 库=库)
        加功能("测 · 带图问", "文本", "测 · 看图家", "看图模型", 库=库)
        加供应商("测 · 看图命令行", "命令行", "claude", "sonnet", 库=库)
        设同意("测 · 看图命令行", True, 库=库)
        加功能("测 · 带图问命令行", "文本", "测 · 看图命令行", "sonnet", 库=库)
        原发网页图, 原限速图 = _发网页请求, _限速
        载荷们: list = []
        try:
            globals()["_限速"] = lambda *a, **k: None
            globals()["_发网页请求"] = lambda 地, 钥, 载, 时, 收=None: (载荷们.append(载), "看见了")[1]
            assert 问("测 · 带图问", "s", "u", 参考图=小红, 重试=0, 库=库) == "看见了"
            话 = 载荷们[-1]["messages"][1]["content"]
            assert isinstance(话, list) and 话[1]["type"] == "image_url", f"图没进请求体:{话}"
            assert 载荷们[-1]["messages"][0] == {"role": "system", "content": "s"}, \
                "system 那条不该跟着变形"
            问("测 · 带图问", "s", "u", 重试=0, 库=库)
            assert 载荷们[-1]["messages"][1]["content"] == "u", \
                "不递图时载荷该跟开这条口之前逐字一样"
            原发命令行图 = _发命令行请求
            递到: list = []
            globals()["_发命令行请求"] = lambda *a, **k: (递到.append(k.get("参考图")), "红色")[1]
            try:
                assert 问("测 · 带图问命令行", "s", "u", 参考图=小红, 重试=0, 库=库) == "红色"
                assert 递到 and 递到[-1] == [小红], f"图没交到命令行那条手上:{递到}"
                问("测 · 带图问命令行", "s", "u", 重试=0, 库=库)
                assert not 递到[-1], f"不递图时命令行那条不该收到图:{递到[-1]}"
            finally:
                globals()["_发命令行请求"] = 原发命令行图
            def 炸不吃图(*a, **k):
                raise urllib.error.HTTPError(
                    "http://x", 400, "Bad Request", {},
                    io.BytesIO(b'{"error":{"message":"does not support image input"}}'))
            globals()["_发网页请求"] = 炸不吃图
            try:
                问("测 · 带图问", "s", "u", 参考图=小红, 重试=0, 库=库)
                raise AssertionError("不吃图那家该报错")
            except 底座错误 as e:
                assert "does not support image input" in str(e), "接口原话得一个字不动地留着"
                assert "设置面板" in str(e), f"英文原话后面得补一句中文出路:{e}"
            try:
                问("测 · 带图问", "s", "u", 重试=0, 库=库)
                raise AssertionError("这次也该报错")
            except 底座错误 as e:
                assert "设置面板" not in str(e), f"没递图的报错不该扯上换模型:{e}"
        finally:
            globals()["_发网页请求"], globals()["_限速"] = 原发网页图, 原限速图
        删功能("测 · 带图问", 库=库)
        删功能("测 · 带图问命令行", 库=库)

        assert next(x for x in 读配置(库=库)["功能"]
                    if x["功能名"] == "示例 · 生成")["种类"] == "文本", "老功能该默认是文本"

        取 = lambda 名: next(x for x in 读配置(库=库)["功能"] if x["功能名"] == 名)
        assert 取("示例 · 生成")["启用"] is True, "补列进来的行该默认开着"
        assert 设启用("示例 · 生成", False, 库=库) is True, "关一行该报改动了"
        assert 取("示例 · 生成")["启用"] is False, "关了之后读回来该是关着的"
        assert "启用" not in inspect.getsource(_查路), "_查路 不该拿启用当闸,它只管露面"
        assert 设启用("示例 · 生成", True, 库=库) is True, "开回来该报改动了"
        assert 取("示例 · 生成")["启用"] is True, "开回来该是开着的"
        assert 设启用("压根没这一行", True, 库=库) is False, "没这一行该报没改动"

        说的 = lambda 名: [f for f in 读配置(库)["功能"] if f["功能名"] == 名][0]["说明"]
        assert "生成" in 说的("示例 · 生成"), \
            "出厂就该带一句「这是哪个软件、哪一屏在用」—— 用户第一次打开面板看的就是它"
        assert 设说明("示例 · 生成", "我自己写的那一句", 库=库) is True
        assert 说的("示例 · 生成") == "我自己写的那一句"
        连库(库).close()
        assert 说的("示例 · 生成") == "我自己写的那一句", "出厂那句不许盖掉人自己写的"
        设说明("示例 · 生成", "", 库=库)
        连库(库).close()
        assert "生成" in 说的("示例 · 生成"), "清空之后再连库,出厂那句该补回来"
        assert 设说明("压根没这一行", "x", 库=库) is False, "没这一行该报没改动"
        那行 = [f for f in 读配置(库)["功能"] if f["功能名"] == "示例 · 生成"][0]
        设说明("示例 · 生成", "换一句", 库=库)
        新行 = [f for f in 读配置(库)["功能"] if f["功能名"] == "示例 · 生成"][0]
        assert {k: v for k, v in 那行.items() if k != "说明"} == \
               {k: v for k, v in 新行.items() if k != "说明"}, "写说明不该动到拨号设置"
        设说明("示例 · 生成", "", 库=库)

        备的 = lambda 名: [f for f in 读配置(库)["功能"] if f["功能名"] == 名][0]["备注"]
        assert 备的("示例 · 生成") == "", "出厂不给备注 —— 那一格归人写,不许替他填"
        assert 设备注("示例 · 生成", "这条我改过", 库=库) is True
        assert 备的("示例 · 生成") == "这条我改过"
        assert "生成" in 说的("示例 · 生成"), "写备注不许动到说明"
        设说明("示例 · 生成", "会话写的", 库=库)
        assert 备的("示例 · 生成") == "这条我改过", "写说明不许动到备注"
        assert 设备注("压根没这一行", "x", 库=库) is False, "没这一行该报没改动"
        设说明("示例 · 生成", "", 库=库)
        设备注("示例 · 生成", "", 库=库)

        assert 取("示例 · 生成")["用力"] == 关档, "补列进来的行该落「关」"
        assert 设用力("示例 · 生成", "high", 库=库) is True
        assert 取("示例 · 生成")["用力"] == "high", "挑过的值该存得住"
        assert 设用力("示例 · 生成", "ultra-high", 库=库) is True, "没见过的原厂值也得存得下"
        for 坏 in ("", "随便想想"):
            try:
                设用力("示例 · 生成", 坏, 库=库)
                raise AssertionError(f"「{坏}」该被拦下")
            except 底座错误:
                pass
        设用力("示例 · 生成", 关档, 库=库)
        源 = inspect.getsource(sys.modules[__name__])
        for 旧 in _老档名对照:
            assert 源.count(旧) <= 2, f"「{旧}」又跑回代码里了 —— 档名只许用各家原厂的值"
        assert _网页用力(关档, "https://api.deepseek.com/chat/completions") \
            == ("thinking", {"type": "disabled"}), \
            "DeepSeek 那家的「关」必须还是那句 thinking disabled(铁律,见 _网页用力 上头)"
        assert _网页用力(关档, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions") \
            == ("reasoning_effort", "low"), \
            "关不掉的家,「关」得发这家的最低档 —— 什么都不发就是这次要治的病"
        assert _网页用力(关档, "http://127.0.0.1:8317/v1/chat/completions",
                     ("minimal", "low", "high")) == ("reasoning_effort", "minimal"), \
            "最低档要跟着这家自己的清单走,不许写死成 low"
        assert _最低档(("关", "low", "high")) == "low", "保留字「关」不许当成一个档发出去"
        assert _最低档(()) == "low" and _最低档(None) == "low", "清单空了按网页接口的默认档"
        assert _关法说明("网页接口", "https://api.deepseek.com/chat/completions") == "真关掉"
        assert _关法说明("命令行", "claude") == "真关掉", "命令行那条靠两条环境变量,是真关得掉的"
        assert _关法说明("网页接口", "http://127.0.0.1:8317/v1/chat/completions") == "最低档 low", \
            "没有真开关的家得说实话 —— 别让人以为点了「关闭」就真关了"
        assert "关法" in 读配置(库=库)["供应商"][0], "面板要的那句话得跟着 读配置 一起出去"

        assert 排档(["high", "low", "medium", "minimal", "none"]) \
            == ["none", "minimal", "low", "medium", "high"], "接口报的顺序是乱的,得按 _档序 排"
        assert 排档(["关", "max", "low", "怪档"]) == ["low", "max", "怪档"], \
            "保留字「关」要剔掉;不认识的档排最后 —— 不许把没见过的档当成「最低」发出去"
        assert 排档([]) == [] and 排档(None) == []
        assert _从话里认档("unknown variant `__probe__`, expected one of `none`, `minimal`, "
                      "`low`, `medium`, `high`, `xhigh`, `max` at line 1") \
            == ["none", "minimal", "low", "medium", "high", "xhigh", "max"], "DeepSeek 那种写法"
        assert _从话里认档('level "__probe__" not supported, valid levels: low, medium, high, '
                      'xhigh, max') == ["low", "medium", "high", "xhigh", "max"], "CPA 反代那种"
        assert _从话里认档('{"received":"__probe__","options":["none","minimal","low","medium",'
                      '"high","xhigh","max"],"path":["reasoning_effort"]}') \
            == ["none", "minimal", "low", "medium", "high", "xhigh", "max"], "AMD 那种 JSON"
        assert _从话里认档("Invalid reasoning_effort: __probe__. Valid values are: high, low, "
                      "medium, minimal, none") == ["none", "minimal", "low", "medium", "high"], \
            "Google 那种"
        assert _从话里认档("Thinking level MINIMAL is not supported for this model") == [], \
            "只提到一个档名 = 它在说我们发的那个值不行,不是在列它认哪几档"
        assert _从话里认档("OpenCode's free tier can only be used in OpenCode") == []
        assert _从话里认档("max_tokens is required") == [], "max_tokens 里那个 max 不是档名"
        指 = _通道指纹("网页接口", "http://x/v1/chat/completions", "m1")
        def 笔(**格):
            底 = {"强度档": "", "档位来源": "", "档位探于": "", "档位指纹": ""}
            底.update(格)
            return 底
        看 = 模型档位("网页接口", "http://x/v1/chat/completions", "m1",
                   笔(强度档="low,medium,high,xhigh,max", 档位来源="接口自报",
                     档位探于="2026-09-08 10:00:00", 档位指纹=指))
        assert 看["档们"] == ["low", "medium", "high", "xhigh", "max"] and 看["来源"] == "接口自报" \
            and not 看["过期"], f"探过的就按探出来的算:{看}"
        assert 模型档位("网页接口", "http://x/v1/chat/completions", "m1", None)["来源"] == "没探过"
        assert 模型档位("网页接口", "http://x/v1/chat/completions", "m1",
                    笔())["来源"] == "没探过", "笔记行在、但没探过档位,照样是没探过"
        瞎 = 模型档位("网页接口", "http://x/v1/chat/completions", "m1",
                  笔(档位来源="不吃这一格", 档位指纹=指))
        assert 瞎["档们"] == [] and 瞎["来源"] == "不吃这一格", f"不吃这一格得回空清单:{瞎}"
        旧 = 模型档位("网页接口", "http://别处/v1/chat/completions", "m1",
                  笔(强度档="none,low", 档位来源="接口自报", 档位指纹=指))
        assert 旧["过期"] and 旧["来源"] == "没探过", f"地址变了就得标过期:{旧}"
        assert _网页用力(关档, "http://x", ["none", "minimal", "low"]) == ("reasoning_effort", "none"), \
            "「关」发的是**这个模型**清单里最低的那一档 —— DeepSeek / AMD 真认 none"
        assert _网页用力(关档, "http://x", []) == (None, None), \
            "探出来不吃这一格的模型,一个强度字段都不许发"
        assert _网页用力("high", "http://x", []) == (None, None), \
            "库里存着老值也不发 —— 屏上灰着、发出去却带着,就是又一处假状态"
        assert _网页用力(关档, "http://x", None) == ("reasoning_effort", "low"), \
            "None = 没给清单(不是「不吃」),照旧按默认档算"
        assert _关法说明("网页接口", "http://x", []) == "没这一格"
        一家 = 读配置(库=库)["供应商"][0]
        assert isinstance(一家.get("模型档位"), dict), "每个模型一份档位得跟着 读配置 出去"

        assert _认thinking("https://api.deepseek.com/chat/completions"), "DeepSeek 那家必须照发"
        assert not _认thinking("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"), \
            "Google 那条端点发了这个字段会 400"
        assert not _认thinking("http://127.0.0.1:8317/v1/chat/completions"), "反代那家也不发"
        assert not _认thinking(""), "地址空着也不许发"
        assert _想了多少({"usage": {"completion_tokens_details": {"reasoning_tokens": 178}}}) == 178
        assert _想了多少({"usage": {"reasoning_tokens": 42}}) == 42, "平铺那种写法也得认"
        assert _想了多少({"usage": {"completion_tokens_details": {"reasoning_tokens": 0}}}) == 0
        for 没报 in ({}, {"usage": {}}, {"usage": {"completion_tokens": 9}},
                    {"usage": {"completion_tokens_details": {}}}, None):
            assert _想了多少(没报) is None, f"没报这一格必须回 None 不是 0:{没报}"
        谷 = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        assert _想了多少({"usage": {"total_tokens": 1018, "prompt_tokens": 57,
                                 "completion_tokens": 2}}, 谷) == 959, \
            "Google 那条路的「想了」= total - prompt - completion(拿原生端点校准过)"
        assert _想了多少({"usage": {"total_tokens": 59, "prompt_tokens": 57,
                                 "completion_tokens": 2}}, 谷) is None, \
            "差值是 0 = 不知道,不许说成「它一个字都没想」"
        assert _想了多少({"usage": {"total_tokens": 1018, "prompt_tokens": 57,
                                 "completion_tokens": 2}}, "https://api.deepseek.com/x") is None, \
            "这个减法只在 Google 那条路上校准过,别拿去替别家宣称"
        记 = 连库(库)
        _记日志(记, "测 · 想了", "测 · 全档家", "m一", True, time.time(), "", 7, "high")
        _记日志(记, "测 · 想了", "测 · 全档家", "m一", True, time.time(), "", 0, "high")
        _记日志(记, "测 · 想了", "测 · 全档家", "m一", True, time.time(), "", 99, 关档)
        _记日志(记, "测 · 想了", "测 · 全档家", "m二", True, time.time(), "", None, "high")
        账 = 想过账(记)
        记.close()
        assert 账["测 · 全档家\nm一\nhigh"]["想了"] == 0, "该拿最近那一次,不是最大那一次"
        assert "测 · 全档家\nm二\nhigh" not in 账, "没报这一格的不许进账 —— 那是「不知道」不是 0"
        assert 账[f"测 · 全档家\nm一\n{关档}"]["想了"] == 99, "「关」那一档得单独记一笔"
        assert 读配置(库=库, 日志条数=1)["日志"][0]["想了"] is None, "日志那一列该原样报出去"
        assert "想过" in 读配置(库=库, 日志条数=0), "面板要的那张账得跟着 读配置 一起出去"
        assert "收.clear()" in inspect.getsource(_跑), "每轮重试前必须清空那个口袋"
        assert _网页用力("low") == ("reasoning_effort", "low"), "挑了强度就该原样发 reasoning_effort"
        assert '"thinking": {"type": "disabled"},' not in inspect.getsource(问), \
            "thinking 不许再无条件发 —— 它现在归 _网页用力 管"
        for 值 in [关档] + 强度档们("命令行"):
            劲, 关思考 = _命令行用力(值)
            assert not (关思考 and 劲 == "xhigh"), f"「{值}」把 xhigh 配给了关思考,必 400"
        assert 强度档们("网页接口") == ["low", "medium", "high"]
        assert "xhigh" in 强度档们("命令行"), "claude 命令行那条真有 xhigh,别把它漏了"
        assert 强度档们("网页接口", "a, b") == ["a", "b"], "自报的清单该盖过默认"

        加供应商("测 · 强度家", "网页接口", "https://api.example.com/v1/chat/completions",
              "m", 库=库)
        设密钥("测 · 强度家", "sk-jin", 库=库)
        加功能("测 · 关这一档", "文本", "测 · 强度家", "m", 库=库)
        原发网页劲, 原限速劲 = _发网页请求, _限速
        载荷们 = []
        try:
            globals()["_限速"] = lambda *a, **k: None
            globals()["_发网页请求"] = lambda 地, 钥, 载, 时, 收=None: (载荷们.append(dict(载)), "好")[1]
            问("测 · 关这一档", "s", "u", 重试=0, 库=库)
            assert 载荷们[-1].get("reasoning_effort") == "low", \
                f"出厂「关」也得把最低档发出去,不许一个字不发:{载荷们[-1]}"
            assert "thinking" not in 载荷们[-1], "别家不认 thinking 这个名字,发过去必 400"
            设用力("测 · 关这一档", "high", 库=库)
            问("测 · 关这一档", "s", "u", 重试=0, 库=库)
            assert 载荷们[-1].get("reasoning_effort") == "high", "人挑了哪个值就发哪个值"

            def _记档位(**格):
                连 = 连库(库)
                try:
                    _记一格(连, "测 · 强度家", "m", **格)
                    连.commit()
                finally:
                    连.close()
            指 = _通道指纹("网页接口", "https://api.example.com/v1/chat/completions", "m")
            _记档位(强度档="none,minimal,low", 档位来源="接口自报",
                 档位探于="2026-09-08 10:00:00", 档位指纹=指)
            设用力("测 · 关这一档", 关档, 库=库)
            问("测 · 关这一档", "s", "u", 重试=0, 库=库)
            assert 载荷们[-1].get("reasoning_effort") == "none", \
                f"这个模型真认 none,「关」就该发 none,不许还发家级默认的 low:{载荷们[-1]}"
            _记档位(强度档="", 档位来源="不吃这一格", 档位探于="2026-09-08 10:00:00", 档位指纹=指)
            问("测 · 关这一档", "s", "u", 重试=0, 库=库)
            assert "reasoning_effort" not in 载荷们[-1] and "thinking" not in 载荷们[-1], \
                f"不吃这一格的模型,载荷里一个强度字段都不该有:{载荷们[-1]}"
            设用力("测 · 关这一档", "high", 库=库)
            问("测 · 关这一档", "s", "u", 重试=0, 库=库)
            assert "reasoning_effort" not in 载荷们[-1], \
                "库里存着 high 也不发 —— 屏上那一格是灰的,发出去却带着就是假状态"
            设用力("测 · 关这一档", 关档, 库=库)
            无关打过 = []
            def 无关400(地, 钥, 载, 时, 收=None):
                无关打过.append(dict(载))
                raise urllib.error.HTTPError(
                    地, 400, "Bad Request", {}, io.BytesIO(b'model does not exist'))
            globals()["_发网页请求"] = 无关400
            try:
                问("测 · 关这一档", "s", "u", 重试=0, 库=库, 换备选=False)
                raise AssertionError("模型不存在必须报错")
            except 底座错误 as e:
                assert "model does not exist" in str(e)
            assert len(无关打过) == 1 and "reasoning_effort" not in 无关打过[0], \
                "无推理字段的无关400只发一次"
            globals()["_发网页请求"] = lambda 地, 钥, 载, 时, 收=None: (载荷们.append(dict(载)), "好")[1]
            _记档位(强度档="none,minimal,low", 档位来源="接口自报",
                 档位探于="2026-09-08 10:00:00", 档位指纹="网页接口|换了个地址|m")
            设用力("测 · 关这一档", 关档, 库=库)
            问("测 · 关这一档", "s", "u", 重试=0, 库=库)
            assert 载荷们[-1].get("reasoning_effort") == "none", \
                f"过期只改口不换清单:面板摆哪一份、就得发哪一份(见 模型档位):{载荷们[-1]}"
            assert 模型档位("网页接口", "https://api.example.com/v1/chat/completions", "m",
                        _笔记行(连库(库), "测 · 强度家", "m"))["过期"], \
                "指纹对不上得标出过期来 —— 面板靠它说「旧记录,待重探」"
            _记档位(强度档="", 档位来源="", 档位探于="", 档位指纹="")
            设用力("测 · 关这一档", "high", 库=库)

            打过 = []
            def 头一次炸(地, 钥, 载, 时, 收=None):
                打过.append(dict(载))
                if "reasoning_effort" in 载:
                    raise urllib.error.HTTPError(
                        "http://x", 400, "Bad Request", {},
                        io.BytesIO(b'{"error":{"message":"level \\"low\\" not supported, '
                                   b'valid levels: none"}}'))
                return "剥完就通了"
            globals()["_发网页请求"] = 头一次炸
            try:
                问("测 · 关这一档", "s", "u", 重试=0, 库=库)
                raise AssertionError("人自己挑的 high 被拒,必须原样报错、不许悄悄剥掉")
            except 底座错误 as e:
                assert "valid levels" in str(e), f"接口原话得留着:{e}"
            设用力("测 · 关这一档", 关档, 库=库)
            打过.clear()
            assert 问("测 · 关这一档", "s", "u", 重试=0, 库=库) == "剥完就通了", \
                "「关」那一档是底座替他挑的值,被拒了该剥掉重打一次,别让这条功能拨不出去"
            assert len(打过) == 2 and "reasoning_effort" not in 打过[1], \
                f"第二次该是剥干净的那一份:{打过}"
            点名打过 = []
            def 点名字段400(地, 钥, 载, 时, 收=None):
                点名打过.append(dict(载))
                if "reasoning_effort" in 载:
                    raise urllib.error.HTTPError(
                        地, 400, "Bad Request", {}, io.BytesIO(b'Unknown field reasoning_effort'))
                return "点名剥完就通了"
            globals()["_发网页请求"] = 点名字段400
            答 = 问("测 · 关这一档", "s", "u", 重试=0, 库=库, 换备选=False)
            assert 答 == "点名剥完就通了" and len(点名打过) == 2 \
                and "reasoning_effort" in 点名打过[0] and "reasoning_effort" not in 点名打过[1], \
                "点名已发推理字段的400仍剥字段重发一次"
            assert "_限速(conn" in inspect.getsource(_问一趟), \
                "剥完重打也是一次真请求,必须先过这家的刹车(铁律七)"
        finally:
            globals()["_发网页请求"], globals()["_限速"] = 原发网页劲, 原限速劲
        删功能("测 · 关这一档", 库=库)
        def 假HTTP(码, 体):
            return urllib.error.HTTPError("http://x", 码, "e", {}, io.BytesIO(体.encode()))
        assert _怪那格强度(假HTTP(400, 'level "minimal" not supported, valid levels: low, medium'),
                      "reasoning_effort"), "CPA 反代那句真报错得认出来"
        assert _怪那格强度(假HTTP(400, "Thinking level MINIMAL is not supported for this model"),
                      "reasoning_effort"), "Google 那句真报错得认出来"
        assert _怪那格强度(假HTTP(400, 'Unknown name "thinking": Cannot find field'), "thinking"), \
            "字段名被点名的也算"
        assert not _怪那格强度(假HTTP(400, "does not support image input"), "reasoning_effort"), \
            "跟这一格无关的 400 不许剥"
        assert not _怪那格强度(假HTTP(429, "valid levels: low"), "reasoning_effort"), \
            "429 是限流,归 _值得重试 管,别在这儿剥字段"
        炸 = 假HTTP(400, "valid levels: low")
        assert _报错体(炸) == "valid levels: low" and _报错体(炸) == "valid levels: low", \
            "报错体读第二遍还得在 —— 后头 _记日志 还要拿它入库"
        assert 炸.read().decode() == "valid levels: low", "别人照旧 e.read() 也得读得到"

        真run = subprocess.run
        收 = {}
        def 假run(命令, **kw):
            收["可执行"] = 命令[0]
            收["劲"] = 命令[命令.index("--effort") + 1]
            收["环境"] = kw.get("env", {})
            收["命令"], 收["kw"] = list(命令), kw
            带图 = "--input-format" in 命令
            class R:
                returncode = 0
                stdout = ('{"type":"system","subtype":"init"}\n{"type":"assistant"}\n'
                          + json.dumps({"type": "result", "result": "红色"}) + "\n") if 带图 \
                    else json.dumps({"type": "result", "result": "x"})
                stderr = ""
            return R()
        subprocess.run = 假run
        try:
            for 档 in [关档] + 强度档们("命令行"):
                _发命令行请求("claude", "sonnet", "s", "u", False, 60, 档)
                劲, 关思考 = _命令行用力(档)
                assert 收["劲"] == 劲, f"「{档}」发出去的 effort 是 {收['劲']},该是 {劲}"
                有自适应 = "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING" in 收["环境"]
                有额度 = "MAX_THINKING_TOKENS" in 收["环境"]
                assert 有自适应 == 有额度 == 关思考, \
                    f"「{档}」思考那两条没一起进退:自适应={有自适应} 额度={有额度} 该={关思考}"
                assert 收["环境"].get("PROGRESS_VIEW_OFF") == "1", \
                    f"「{档}」把挡进度视图那条弄丢了 —— 四档都得留着,它跟想不想无关"
                assert 收["可执行"] == (_找命令("claude") or "claude"), \
                    f"「{档}」发的是「{收['可执行']}」,该是 _找命令 解析出来的那个"
            大话 = "改" * 200_000
            assert _发命令行请求("claude", "sonnet", "s", 大话, False, 60, 关档) == "红色", \
                "不带图那条也该从 stream-json 里挑出 result 那行"
            无图命 = 收["命令"]
            assert 大话 not in 无图命 and 无图命[1:2] == ["-p"] \
                and 无图命[无图命.index("--input-format") + 1] == "stream-json" \
                and 无图命[无图命.index("--output-format") + 1] == "stream-json" and "--verbose" in 无图命, \
                f"不带图那条提问得走 stdin、三格一起换:{[a[:40] for a in 无图命]}"
            assert 收["kw"].get("input") == _拼命令行话(大话, []) and "stdin" not in 收["kw"], \
                "不带图那条提问该从 stdin 喂进去(喂完就关,不会像开着的空管子那样傻等)"
            assert 收["kw"]["input"].isascii(), "喂进去那行得是纯 ASCII —— Windows 上按本地编码写 stdin 才写不坏中文"
            assert _发命令行请求("claude", "sonnet", "s", "u", False, 60, 关档,
                             参考图=[_纯色图()]) == "红色", "带图那条该从 stream-json 里挑出 result 那行"
            命 = 收["命令"]
            assert "u" not in 命 and 命[命.index("--input-format") + 1] == "stream-json" \
                and 命[命.index("--output-format") + 1] == "stream-json" and "--verbose" in 命, \
                f"带图那条三格得一起换(输入 stream-json 配输出 json 会当场被拒):{命}"
            assert 收["kw"].get("input") == _拼命令行话("u", [_纯色图()]) and "stdin" not in 收["kw"], \
                "带图那条提问连图该从 stdin 喂进去"
            assert "--bare" not in 无图命 and "--bare" not in 命, "绝不许加 --bare(会绕过订阅去扣 API 的钱)"
            _发命令行请求("这命令本机绝对没有xyz", "sonnet", "s", "u", False, 60, 关档)
            assert 收["可执行"] == "这命令本机绝对没有xyz", \
                f"找不到的命令该原样传下去,现在传的是「{收['可执行']}」"
        finally:
            subprocess.run = 真run

        assert "urllib" not in _头("k")["User-Agent"], "别用 urllib 的默认签名,会被 Cloudflare 挡"

        原生头 = _头("k", "https://generativelanguage.googleapis.com/v1beta/models/img:generateContent")
        assert 原生头.get("x-goog-api-key") == "k", "Gemini 原生端点少了 x-goog-api-key,Google 官方会回 401"
        assert "Authorization" not in 原生头, \
            "Gemini 原生端点上不许再发 Authorization —— Google 见了它就走 OAuth,回 401「API keys are not supported」"
        assert "x-goog-api-key" not in _头("k", "https://api.deepseek.com/v1/chat/completions"), \
            "别家不该收到 Google 那个头"
        assert "x-goog-api-key" not in _头("k"), "不给地址时按老样子发,别凭空多一个头"

        加供应商("测 · 生图家", "网页接口", "http://127.0.0.1:1/v1/images/generations",
              "img-一,img-二", 库=库)
        设密钥("测 · 生图家", "sk-shengtu", 库=库)
        设同意("测 · 生图家", True, 库=库)
        assert 加功能("测 · 出图", "生图", "测 · 生图家", 库=库) == "新建", "第一次挂该报「新建」"
        那功 = next(x for x in 读配置(库=库)["功能"] if x["功能名"] == "测 · 出图")
        assert 那功["种类"] == "生图", "种类该存成生图"
        assert 那功["主用模型"] == "img-一", f"模型留空该自动取清单第一个:{那功['主用模型']}"
        assert 加功能("测 · 出图", "生图", "测 · 生图家", "img-二", 库=库) == "改了", "重名该改不该新建"
        assert next(x for x in 读配置(库=库)["功能"]
                    if x["功能名"] == "测 · 出图")["主用模型"] == "img-二", "改完该读得回来"
        assert len([x for x in 读配置(库=库)["功能"] if x["功能名"] == "测 · 出图"]) == 1, "重名不许多出一行"

        取功 = lambda 名: next(x for x in 读配置(库=库)["功能"] if x["功能名"] == 名)
        assert 取功("测 · 出图")["生图路子"] == 路子_OPENAI, "images/generations 那家该判成 openai生图"
        assert 取功("测 · 出图")["吃参考图"] is True, \
            "OpenAI 那条现在吃参考图(底座自己改打 /v1/images/edits),别再报 False"
        assert 取功("示例 · 生成")["吃参考图"] is None \
            and 取功("示例 · 生成")["生图路子"] is None, "文本功能行上这两格该是 None"
        for 家, 址, 功能, 该吃 in [
                ("测 · 生图家 · gem", "http://127.0.0.1:1/v1beta/models/{模型}:generateContent",
                 "测 · 出图 · gem", True),
                ("测 · 生图家 · 聊", "http://127.0.0.1:1/v1/chat/completions",
                 "测 · 出图 · 聊", False)]:
            加供应商(家, "网页接口", 址, "img-一", 库=库)
            设密钥(家, "sk-x", 库=库); 设同意(家, True, 库=库)
            加功能(功能, "生图", 家, 库=库)
            assert 取功(功能)["吃参考图"] is 该吃, \
                f"「{功能}」拨给「{址}」,吃不吃参考图该是 {该吃}"
            assert 取功(功能)["生图路子"] == 生图路子(址), "读配置 算的路子该跟 生图路子() 同一个答案"

        for 调, 功, 该报 in [(问, "测 · 出图", "该用 画图()"),
                           (画图, "示例 · 生成", "该用 问()")]:
            try:
                调(功, "一句话", 库=库) if 调 is 画图 else 调(功, "s", "u", 库=库)
                raise AssertionError(f"「{功}」拿错函数调该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"

        加功能("测 · 出图走命令行", "生图", _测CL, "sonnet", 库=库)
        try:
            画图("测 · 出图走命令行", "一只猫", 库=库)
            raise AssertionError("生图拨给命令行那家该报错")
        except 底座错误 as e:
            assert "只能走网页接口" in str(e), f"报错内容不对:{e}"

        try:
            画图("测 · 出图", "一只猫", 超时=2, 重试=0, 库=库)
            raise AssertionError("连不上该抛错")
        except 底座错误:
            pass
        conn = 连库(库)
        图败 = conn.execute("SELECT * FROM 日志 WHERE 功能='测 · 出图'").fetchone()
        assert 图败 is not None and 图败["用了谁"] == "测 · 生图家", "生图失败也得进日志"
        assert 图败["模型"] == "img-二", "日志得记下用的哪个模型"
        最长 = conn.execute("SELECT MAX(LENGTH(IFNULL(报错原文,''))) FROM 日志").fetchone()[0]
        assert 最长 < 2000, f"日志里存了长达 {最长} 字符的东西,像是把图塞进去了"
        conn.close()

        for 名, 种, 家, 该报 in [("", "生图", "测 · 生图家", "起个名"),
                              ("测 · 坏活", "外星种类", "测 · 生图家", "种类只能是"),
                              ("测 · 坏活", "生图", "根本没这家", "供应商表里没有")]:
            try:
                加功能(名, 种, 家, 库=库)
                raise AssertionError(f"({名},{种},{家}) 该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"
        assert not any(x["功能名"] == "测 · 坏活" for x in 读配置(库=库)["功能"]), \
            "参数不合格时不许留下半拉行"

        加供应商("测 · 数数家", "网页接口", "https://api.example.com/v1/chat/completions", "m", 库=库)
        conn = 连库(库)
        conn.execute("INSERT INTO 日志(时刻,功能,用了谁,模型,成没成,耗时毫秒,报错原文) "
                     "VALUES(?,?,?,?,?,?,?)",
                     ("2020-01-01 08:00:00", "测 · 老账", "测 · 数数家", "m", 1, 1, ""))
        conn.close()
        assert next(x for x in 读配置(库=库)["供应商"]
                    if x["名"] == "测 · 数数家")["今天次数"] == 0, \
            "别的日子那条记录不许算进今天 —— 这一格答的是「今天」"
        conn = 连库(库)
        for 成 in (1, 0):
            conn.execute("INSERT INTO 日志(时刻,功能,用了谁,模型,成没成,耗时毫秒,报错原文) "
                         "VALUES(?,?,?,?,?,?,?)",
                         (time.strftime("%Y-%m-%d %H:%M:%S"), "测 · 今账", "测 · 数数家",
                          "m", 成, 1, ""))
        conn.close()
        assert next(x for x in 读配置(库=库)["供应商"]
                    if x["名"] == "测 · 数数家")["今天次数"] == 2, "今天的成和败都得算进去"
        近况 = next(x for x in 读配置(库=库)["供应商"] if x["名"] == "测 · 数数家")["近7天"]
        assert 近况 == {"m": {"次": 2, "成": 1}}, \
            f"近 7 天该按模型数、成败分开数,2020 年那条不许算进来,实得 {近况}"

        assert len(读配置(库=库, 日志条数=2)["日志"]) <= 2, "日志条数该收得住"
        conn = 连库(库)
        for i in range(3):
            _记日志(conn, f"测 · 分页{i}", "测 · 数数家", "m", i != 1,
                    time.time(), '逗号,引号"\n换行' if i == 1 else "", i, "high")
        conn.close()
        全日志数 = 读配置(库=库, 日志条数=0)["日志总数"]
        分页 = 读配置(库=库, 日志条数=2, 日志跳过=1)
        assert 分页["日志总数"] == 全日志数, "分页时日志总数不许跟着变"
        assert [x["功能"] for x in 分页["日志"]] == ["测 · 分页1", "测 · 分页0"], \
            "日志跳过得按倒序翻到下一页"
        全文 = 读配置(库=库, 日志条数=2, 日志跳过=1, 日志报错全文=True)["日志"][0]
        assert 全文["报错原文"] == '逗号,引号"\n换行' and 全文["用力"] == "high", \
            "CSV 导出要拿到完整报错与推理强度"

        统库 = os.path.join(d, "stats.db")
        assert 读配置(库=统库)["汇总"] == {"今日调用": 0, "总调用": 0, "今日错误": 0, "总错误": 0}, \
            "一条日志都没有的库,四格都得是 0,不许是 None(页面上会画成空白)"
        昨天 = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
        现在 = time.strftime("%Y-%m-%d %H:%M:%S")
        conn = 连库(统库)
        conn.executemany(
            "INSERT INTO 日志(时刻,功能,用了谁,模型,成没成,耗时毫秒,报错原文) VALUES(?,?,?,?,?,1,'')",
            [("2020-01-01 08:00:00", "测 · 老成", "甲", "m", 1),
             ("2020-01-01 09:00:00", "测 · 老败", "甲", "m", 0),
             (昨天 + " 23:59:59", "测 · 零点前一秒败", "甲", "m", 0),
             (昨天 + " 23:59:59", "测 · 成败没记", "甲", "m", None),
             (time.strftime("%Y-%m-%d") + " 00:00:00", "测 · 零点整败", "乙", "m", 0),
             (现在, "测 · 今成", "乙", "m", 1),
             (现在, "测 · 今成二", "乙", "m", 1)])
        conn.commit(); conn.close()
        汇总 = 读配置(库=统库)["汇总"]
        assert 汇总 == {"今日调用": 3, "总调用": 7, "今日错误": 1, "总错误": 4}, (
            "今天零点整起才算今天(昨天 23:59:59 那条不算),成没成空着的算失败(跟日志表画「✗ 败」"
            f"同一口径),各家加在一起数,实得 {汇总}")
        翻页 = 读配置(库=统库, 日志条数=1, 日志跳过=5)
        assert 翻页["汇总"] == 汇总 and 翻页["日志总数"] == 汇总["总调用"], \
            "四格数的是整张日志表,不许跟着日志翻页变;「一共」那格跟日志总数必须是同一个数"

        筛库 = os.path.join(d, "log-filters.db")
        筛名 = "测筛 · 甲' OR 1=1 --"
        conn = 连库(筛库)
        conn.executemany(
            "INSERT INTO 日志(时刻,功能,用了谁,模型,成没成,耗时毫秒,报错原文) VALUES(?,?,?,?,?,1,?)",
            [(现在, 筛名, "甲", "m", 1, ""),
             (现在, 筛名, "甲", "m", 0, "错" * 400),
             (现在, 筛名, "甲", "m", None, "老行"),
             (现在, "测筛 · 乙", "乙", "m", 0, "错"),
             (现在, "测筛 · 乙", "乙", "m", 1, ""),
             (现在, 筛名 + "二", "甲", "m", 0, "错")])
        筛前 = [tuple(r) for r in conn.execute("SELECT * FROM 日志 ORDER BY rowid")]
        全筛 = 读配置(筛库, 日志条数=100)
        for 参数, 应数 in (({"日志功能名": 筛名}, 3), ({"日志只看失败": True}, 4),
                         ({"日志功能名": 筛名, "日志只看失败": True}, 2),
                         ({"日志功能名": "不存在' OR 1=1 --"}, 0)):
            结果 = 读配置(筛库, 日志条数=100, **参数)
            assert len(结果["日志"]) == 结果["日志总数"] == 应数, f"筛选条数与总数应为 {应数}:{结果}"
            assert 结果["汇总"] == 全筛["汇总"], "筛选不许改变面板顶部全库统计"
            if 参数.get("日志功能名"):
                assert all(r["功能"] == 参数["日志功能名"] for r in 结果["日志"]), "功能名必须精确匹配"
            if 参数.get("日志只看失败"):
                assert all(not r["成没成"] for r in 结果["日志"]), "失败筛选不许混入成功行"
        筛页 = 读配置(筛库, 日志条数=1, 日志跳过=1, 日志功能名=筛名,
                    日志只看失败=True, 日志报错全文=True)
        assert len(筛页["日志"]) == 1 and 筛页["日志总数"] == 2 \
            and 筛页["日志"][0]["报错原文"] == "错" * 400, "筛选分页与全文导出须沿用同一条件"
        assert 读配置(筛库, 日志条数=0, 日志功能名=筛名, 日志只看失败=True)["日志总数"] == 2
        assert [tuple(r) for r in conn.execute("SELECT * FROM 日志 ORDER BY rowid")] == 筛前, \
            "读配置的日志筛选必须只读,一格都不能改"
        conn.close()
        print("  ✓ 日志筛选:功能名 / 失败(含空值) / 叠加 / 总数 / 分页 / 只读")

        for 调用地址, 该是 in [
            ("https://api.deepseek.com/chat/completions", "https://api.deepseek.com/models"),
            ("http://127.0.0.1:8317/v1/chat/completions", "http://127.0.0.1:8317/v1/models"),
            ("http://127.0.0.1:8317/v1/images/generations", "http://127.0.0.1:8317/v1/models"),
            ("http://127.0.0.1:8317/v1beta/models/{模型}:generateContent",
             "http://127.0.0.1:8317/v1beta/models"),
            ("https://x.example.com/v1", "https://x.example.com/v1/models"),
        ]:
            得 = _模型清单地址(调用地址)
            assert 得 == 该是, f"{调用地址} 该换算成 {该是},算出来的是 {得}"
        assert _拆模型清单({"data": [{"id": "a"}, {"id": "b"}, {"id": "a"}]}) == ["a", "b"], \
            "OpenAI 那套读 data[].id,重复的只留一个"
        assert _拆模型清单({"data": [{"id": "deepseek/deepseek-chat"}]}) == ["deepseek/deepseek-chat"], \
            "OpenAI 那套的 id 里带斜杠是模型名的一部分,不许剥"
        assert _拆模型清单({"models": [{"name": "models/gemini-3.7-flash-high"}]}) == \
            ["gemini-3.7-flash-high"], "Gemini 那套的 models/ 前缀得剥掉"
        assert _拆模型清单({"啥也不是": 1}) == [], "认不出的回法就报空,别猜"
        assert _清单看图({"data": [
            {"id": "眼", "architecture": {"input_modalities": ["text", "image"]}},
            {"id": "瞎", "architecture": {"input_modalities": ["text"]}},
            {"id": "没写"}]}) == {"眼": "能", "瞎": "不能"}, "AMD 那套形状认错了"
        assert _清单看图({"models": [
            {"name": "models/g眼", "supportedInputModalities": ["text", "IMAGE", "audio"]},
            {"name": "models/g瞎", "supportedInputModalities": ["text"]},
            {"name": "models/gpt-image-2"}]}) == {"g眼": "能", "g瞎": "不能"}, \
            "Gemini 原生那套认错了(名字得剥掉 models/,大小写不敏感)"
        assert _清单看图({"啥也不是": 1}) == {}, "认不出的回法就报空"
        assert _认图格式(_纯色图()) == "image/png", "测试递的那张图得是本机认得出的 PNG"
        assert _纯色图().startswith(b"\x89PNG") and b"IEND" in _纯色图()[-12:], "PNG 头尾不全"
        import io as _io
        def _四百(话, 码=400):
            return urllib.error.HTTPError("http://x", 码, "x", None, _io.BytesIO(话.encode()))
        assert _怪图(_四百('{"error":"This model does not support image input"}')), "400 + 说图 = 怪图"
        assert _怪图(_四百('{"error":{"message":"messages[0].content must be a string"}}')), \
            "Groq 只收纯文字的模型拒数组不提图,也得认成怪图、退回纯文字再问"
        assert _怪图(_四百('{"error":{"code":"1210","message":"messages.content.type 参数非法，取值范围 [\'text\']"}}')), \
            "智谱只收纯文字的模型说片类型非法,同上"
        assert not _怪图(_四百("model not found")), "400 但说的不是图,不许算到看图头上"
        assert not _怪图(_四百("image quota", 429)), "429 是这一刻打不通,不许把看图染成不能"
        assert _递得进图("网页接口") and _递得进图("命令行") and not _递得进图("别的"), \
            "两条路都递得进图(命令行也走 stream-json);不认识的类型当递不进"
        assert 读配置(库=库)["档序"] == list(_档序), "档序得跟着读配置出去,页面不另写一份"
        try:
            问模型清单(_测CL, 库=库)
            raise AssertionError("命令行那家该报「没有列模型这个接口」")
        except 底座错误 as e:
            assert "没有「列模型」这个接口" in str(e), f"报错内容不对:{e}"

        assert all(_像免费的(x) for x in
                   ("mimo-v2.5-free", "laguna-s-2.1-free", "big-pickle")), "免费的不许被挡掉"
        assert not any(_像免费的(x) for x in
                       ("gpt-5.5", "claude-haiku-4-5", "gemini-3-flash", "deepseek-v4-pro",
                        "free-lunch", "muse-spark-1.2")), "收费的一个都不许放进来"
        加供应商("测 · 藏家", "网页接口", "https://api.example.com/v1/chat/completions",
              "m一,m二", 库=库)
        assert 藏着的("测 · 藏家", 库=库) == [], "刚建的一家不该藏着谁"
        assert 藏("测 · 藏家", "m二", "HTTP 429 配额超限", 库=库), "第一次记该报「新记的」"
        assert not 藏("测 · 藏家", "m二", "换个理由", 库=库), "同一个再记一次不算新的"
        藏的 = 藏着的("测 · 藏家", 库=库)
        assert len(藏的) == 1 and 藏的[0]["模型"] == "m二", f"该藏着 m二:{藏的}"
        assert 藏的[0]["备注"] == "换个理由", "再记一次要把理由更新掉(人看的就是这一格)"
        assert 藏的[0]["何时"], "得记下什么时候测出来的 —— 不然半年后没法判断值不值得放回"
        assert 藏着的(库=库) and all("供应商" in r for r in 藏着的(库=库)), \
            "不给家名就列全部,每行得带着是哪一家"
        藏("测 · 藏家", "m二", "", 库=库)
        assert 藏着的("测 · 藏家", 库=库)[0]["备注"] == "换个理由", "留空再摁一次不许清掉原来那句"
        加功能("测 · 拨给藏起来的", "文本", "测 · 藏家", "m二", 库=库)
        assert [f for f in 读配置(库=库)["功能"]
                if f["功能名"] == "测 · 拨给藏起来的"][0]["启用"], "藏一个模型不许悄悄停掉功能"
        assert 放回("测 · 藏家", "m二", 库=库), "放得回来"
        assert not 放回("测 · 藏家", "m二", 库=库), "放回一个没藏的该报 False,不报错"
        assert 藏着的("测 · 藏家", 库=库) == [], "放回之后就不该再列出来"
        笔 = [x for x in 读配置(库=库)["供应商"] if x["名"] == "测 · 藏家"][0]["模型笔记"]
        留 = [x for x in 笔 if x["模型"] == "m二"]
        assert 留 and 留[0]["备注"] == "换个理由" and not 留[0]["藏了"], \
            f"放回之后那一行该留着、只是不藏了:{笔}"
        for 缺, 该报 in ((("", "m一"), "哪一家"), (("测 · 藏家", ""), "哪一家")):
            try:
                藏(*缺, 库=库)
                raise AssertionError(f"{缺} 该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"
        记笔记("测 · 藏家", "m一", 备注="贵", 库=库)
        记笔记("测 · 藏家", "m一", 判断="长文能扛,短活别用它", 库=库)
        取 = lambda 名, m="m一": [x for x in
                                [y for y in 读配置(库=库)["供应商"] if y["名"] == 名][0]["模型笔记"]
                                if x["模型"] == m][0]
        一 = 取("测 · 藏家")
        assert 一["备注"] == "贵" and 一["判断"] == "长文能扛,短活别用它", f"两格该各存各的:{一}"
        记笔记("测 · 藏家", "m一", 备注="", 库=库)
        assert 取("测 · 藏家")["判断"], "清空备注不许连判断一起清掉"
        assert 取("测 · 藏家")["免费"] == "", "没查过的该是空串,不许默认成免费或收费"
        记笔记("测 · 藏家", "m一", 免费="免费", 免费出处="官网定价页 2026-09-16", 库=库)
        一 = 取("测 · 藏家")
        assert 一["免费"] == "免费" and 一["免费出处"] and 一["判断"], f"免费两格该各存各的:{一}"
        try:
            记笔记("测 · 藏家", "m一", 免费="是", 库=库)
            raise AssertionError("免费只收 免费/收费/查不到/空,「是」该当场报错")
        except 底座错误:
            pass

        设密钥("测 · 藏家", "sk-zangjia", 库=库)
        原发网页 = _发网页请求
        try:
            globals()["_发网页请求"] = lambda *a, **k: "收到"
            r = 试模型("测 · 藏家", "m一", 库=库)
            assert r["通了"] and r["话"] == "收到", f"该记成通了:{r}"
            行 = 取("测 · 藏家")
            assert 行["连通"] == "通" and 行["测于"] and 行["测出的话"] == "收到", f"三格该都落库:{行}"
            assert 行["备注"] == "" and 行["判断"], "测一下不许动人写的那两格"
            globals()["_发网页请求"] = lambda *a, **k: "   "
            assert not 试模型("测 · 藏家", "m一", 库=库)["通了"], "回一个空的不许算通"
            assert "空" in 取("测 · 藏家")["测出的话"], "得写清楚是空的,不然人看不懂为什么不通"
            def 炸(*a, **k):
                raise 底座错误("HTTP 429 配额超限")
            globals()["_发网页请求"] = 炸
            assert not 试模型("测 · 藏家", "m一", 库=库)["通了"], "打不通该记成不通"
            assert "429" in 取("测 · 藏家")["测出的话"], "报错原文得留着"
            assert not 取("测 · 藏家")["藏了"], "测不通**不自动摁下去** —— 藏是人做的决定"
            assert [x for x in 读配置(库=库)["日志"] if x["功能"] == "(连通测试)"], \
                "连通测试也得进日志表"
            加供应商("测 · 画图家", "网页接口", "https://api.example.com/v1/images/generations",
                  "画一,画二", 库=库)
            设密钥("测 · 画图家", "sk-huatu", 库=库)
            try:
                试模型("测 · 画图家", "画一", 库=库)
                raise AssertionError("生图那条该拦下来")
            except 底座错误 as e:
                assert "生图" in str(e), f"报错内容不对:{e}"
            加供应商("测 · 试订阅家", "网页接口", "https://api.example.com/v1/chat/completions",
                  "m一", 库=库)
            设密钥("测 · 试订阅家", "sk-dingyue", 库=库)
            设吃订阅("测 · 试订阅家", True, 库=库)
            try:
                试模型("测 · 试订阅家", "m一", 库=库)
                raise AssertionError("没点过同意的那家该拦下来")
            except 底座错误 as e:
                assert "账号风险" in str(e), f"报错内容不对:{e}"

            import io as _io
            发了 = []
            def 答色(图: bytes, 对: bool) -> str:
                i = [c[1] for c in _看图色们].index(_纯色图的色(图))
                return _看图色们[i if 对 else (i + 1) % len(_看图色们)][0] + "色"
            def 假发(看得见: bool, 不收图: bool = False):
                def 发(地址, 密钥, 载荷, 超时, 收=None):
                    内 = 载荷["messages"][-1]["content"]
                    带 = isinstance(内, list)
                    发了.append(带)
                    if 带 and 不收图:
                        raise urllib.error.HTTPError(地址, 400, "Bad Request", None, _io.BytesIO(
                            b'{"error":{"message":"This model does not support image input"}}'))
                    if not 带:
                        return "收到"
                    return 答色(base64.b64decode(内[1]["image_url"]["url"].split(",", 1)[1]), 看得见)
                return 发
            assert {_挑看图色()[0] for _ in range(200)} == {c[0] for c in _看图色们}, \
                "测试色该每次随机挑,四色都得挑得到(固定一色瞎蒙也蒙得中)"
            红, 蓝 = _看图色们[0], _看图色们[1]
            assert _认出色("红色", 红) and _认出色("Red.", 红) and not _认出色("红色", 蓝), "认颜色该只认挑中那一色"
            assert not _认出色("红色或蓝色", 红), "答里点了两种色是在猜,不许算能看图"
            assert not _认出色("I can't see the rendered image", 红), "英文得按整词认,rendered 里的 red 不算"
            assert all(_纯色图的色(_纯色图(*c[1])) == c[1] for c in _看图色们), "读色得读回递出去的那一色"
            加供应商("测 · 看图家", "网页接口", "https://api.example.com/v1/chat/completions",
                  "眼,瞎,清单瞎,认错", 库=库)
            设密钥("测 · 看图家", "sk-kantu", 库=库)
            globals()["_发网页请求"] = 假发(True)
            r = 试模型("测 · 看图家", "眼", 库=库)
            assert r["通了"] and (r["看图"], r["看图来源"]) == ("能", "测试"), f"答对颜色 = 能看图:{r}"
            assert 发了 == [True], f"看图的模型只发一次(带图那一问),请求次数不许比改之前多:{发了}"
            assert isinstance(取("测 · 看图家", "眼")["测速毫秒"], int), "测通了得记下用时"
            assert 取("测 · 看图家", "眼")["看图"] == "能", "看图那一格得落库"
            发了.clear()
            globals()["_发网页请求"] = 假发(True, 不收图=True)
            r = 试模型("测 · 看图家", "瞎", 库=库)
            assert r["通了"] and (r["看图"], r["看图来源"]) == ("不能", "测试"), f"不收图该记不能:{r}"
            assert 发了 == [True, False], f"带图被拒要补一问纯文字:{发了}"
            assert isinstance(取("测 · 看图家", "瞎")["测速毫秒"], int), "用时记的是补的那一问(成了的)"
            globals()["_发网页请求"] = 假发(False)
            r = 试模型("测 · 看图家", "认错", 库=库)
            assert r["通了"] and r["看图"] == "不能", f"认不出颜色不许记成能:{r}"
            c = 连库(库)
            _记一格(c, "测 · 看图家", "清单瞎", 看图="不能", 看图来源="清单自报")
            c.close()
            发了.clear()
            globals()["_发网页请求"] = 假发(True)
            r = 试模型("测 · 看图家", "清单瞎", 库=库)
            assert r["通了"] and 发了 == [False], f"清单说不能的不许再递图:{发了}"
            assert 取("测 · 看图家", "清单瞎")["看图来源"] == "清单自报", "没真测看图,来源不许改"
            globals()["_发网页请求"] = 炸
            r = 试模型("测 · 看图家", "瞎", 库=库)
            assert not r["通了"], "429 该记不通"
            assert (取("测 · 看图家", "瞎")["看图"], 取("测 · 看图家", "瞎")["看图来源"]) == ("不能", "测试"), \
                "一次打不通不许改看图那一格"
            assert 取("测 · 看图家", "瞎")["测速毫秒"] is None, "没通就清空用时"
            设限速("测 · 看图家", 0, 1, 库=库)
            try:
                试模型("测 · 看图家", "眼", 库=库)
            except 撞上限:
                pass
            格们 = ("连通", "测于", "测出的话", "看图", "看图来源", "测速毫秒")
            前 = {k: 取("测 · 看图家", "眼")[k] for k in 格们}
            try:
                试模型("测 · 看图家", "眼", 库=库)
                raise AssertionError("每小时上限 1 次,第二下该被本机挡下")
            except 撞上限 as e:
                assert "上限" in str(e), f"报错得说清是撞了本机上限:{e}"
                assert str(e).index("「调用频率上限」") < str(e).index("python3"), \
                    f"放宽的路先指面板那一格,命令行排后头:{e}"
            assert {k: 取("测 · 看图家", "眼")[k] for k in 格们} == 前, \
                f"被本机上限挡下不许写「不通」,一格都不许动:{前}"
            设限速("测 · 看图家", 0, 0, 库=库)
            原发命令行 = _发命令行请求
            递图: list = []
            globals()["_发命令行请求"] = lambda *a, **k: (
                递图.append(k.get("参考图")), 答色(k["参考图"][0], True) if k.get("参考图") else "收到")[1]
            try:
                加供应商("测 · 命令行看图家", "命令行", "claude", "sonnet", 库=库)
                设吃订阅("测 · 命令行看图家", False, 库=库)
                c = 连库(库)
                _记一格(c, "测 · 命令行看图家", "老行", 看图="不能", 看图来源="这条路递不进")
                c.close()
                老 = 取("测 · 命令行看图家", "老行")
                assert (老["看图"], 老["看图来源"]) == ("", ""), f"老库里「这条路递不进」成了假话,连库时该清空:{老}"
                r = 试模型("测 · 命令行看图家", "sonnet", 库=库)
            finally:
                globals()["_发命令行请求"] = 原发命令行
            assert r["通了"] and (r["看图"], r["看图来源"]) == ("能", "测试"), f"命令行那家:{r}"
            assert 递图 and 递图[-1] and _认图格式(递图[-1][0]) == "image/png", f"命令行那家「测试」该递那张纯色图:{递图}"
            家们 = {x["名"]: x for x in 读配置(库=库)["供应商"]}
            assert 家们["测 · 命令行看图家"]["递得进图"] is True and 家们["测 · 看图家"]["递得进图"] is True, \
                "递得进图那一格得跟着读配置出去"
        finally:
            globals()["_发网页请求"] = 原发网页

        老库 = os.path.join(d, "老配置.db")
        老 = sqlite3.connect(老库)
        老.execute("CREATE TABLE 藏起来 (供应商 TEXT, 模型 TEXT, 为什么 TEXT, 何时 TEXT,"
                 " PRIMARY KEY (供应商, 模型))")
        老.execute("INSERT INTO 藏起来 VALUES('老家','老模型','当年打不通','2026-01-01 00:00:00')")
        老.commit()
        老.close()
        c老 = 连库(老库)
        搬 = c老.execute("SELECT * FROM 模型笔记").fetchall()
        assert len(搬) == 1 and 搬[0]["模型"] == "老模型" and 搬[0]["藏了"] == 1, \
            f"老库那张表该整张搬过来、还是藏着的:{[dict(x) for x in 搬]}"
        assert 搬[0]["备注"] == "当年打不通", "「当初为什么」那句得跟着搬,它是这张表存在的理由"
        assert not c老.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='藏起来'"
                             ).fetchone(), "搬完老表要删掉 —— 留着下一个人不知道信哪张"
        c老.close()
        连库(老库).close()

        老库2 = os.path.join(d, "老配置2.db")
        老 = sqlite3.connect(老库2)
        老.execute("CREATE TABLE 模型笔记 (供应商 TEXT, 模型 TEXT, 备注 TEXT, 判断 TEXT, 连通 TEXT,"
                 " 测于 TEXT, 测出的话 TEXT, 藏了 INTEGER NOT NULL DEFAULT 0, 何时 TEXT,"
                 " PRIMARY KEY (供应商, 模型))")
        老.execute("CREATE TABLE 日志 (时刻 TEXT, 功能 TEXT, 用了谁 TEXT, 模型 TEXT, 成没成 INTEGER,"
                 " 耗时毫秒 INTEGER, 报错原文 TEXT)")
        老.executemany("INSERT INTO 模型笔记(供应商,模型,连通,测于) VALUES(?,?,?,?)", [
            ("家", "快", "通", "2026-09-15 17:06:24"),
            ("家", "没通", "不通", "2026-09-15 17:06:30"),
            ("家", "日志太远", "通", "2026-09-15 18:00:00")])
        老.executemany("INSERT INTO 日志 VALUES(?,?,?,?,?,?,?)", [
            ("2026-09-15 17:06:24", "(连通测试)", "家", "快", 1, 2045, ""),
            ("2026-09-15 17:06:23", "示例 · 生成", "家", "快", 1, 99999, ""),
            ("2026-09-15 17:06:30", "(连通测试)", "家", "没通", 0, 60000, "超时"),
            ("2026-09-15 17:00:00", "(连通测试)", "家", "日志太远", 1, 1500, "")])
        老.commit()
        老.close()
        c老 = 连库(老库2)
        速 = {r["模型"]: r["测速毫秒"] for r in c老.execute("SELECT 模型, 测速毫秒 FROM 模型笔记")}
        c老.close()
        assert 速 == {"快": 2045, "没通": None, "日志太远": None}, f"老库回填用时不对:{速}"

        for 一份, 该滤 in ((["gemini-3-flash", "gemini-3.1-flash-lite"], False),
                        (["gpt-5.5", "mimo-v2.5-free"], True)):
            assert any(_像免费的(x) for x in 一份) is 该滤, f"这份该不该滤判错了:{一份}"

        assert _对得上前缀("gpt-5.6-terra", ["gpt", "codex"]), "gpt 开头的该留给 GPT 那家"
        assert _对得上前缀("codex-auto-review", ["gpt", "codex"]), "codex 也是 OpenAI 那边的"
        assert not _对得上前缀("gemini-3-flash", ["gpt", "codex"]), "gemini 不许留在 GPT 那家"
        assert not _对得上前缀("claude-sonnet-4-6", ["gpt", "codex"]), "claude 两家都不收"

        加供应商("拉单家", "网页接口", "http://x/v1/chat/completions", "老款,付费款,旧免费-free", 库=库)
        设密钥("拉单家", "k", 库=库)
        c拉 = 连库(库)
        c拉.execute("UPDATE 供应商 SET 免费=1 WHERE 名='拉单家'")
        c拉.close()
        for m in ("甲-free", "旧免费-free"):
            藏("拉单家", m, "测", 库=库)
        c拉 = 连库(库)
        _记一格(c拉, "拉单家", "付费款", 备注="人写的")
        c拉.close()
        加功能("拉单测 · 拨老款", "文本", "拉单家", "老款", 库=库)
        原开 = urllib.request.urlopen
        try:
            urllib.request.urlopen = lambda *a, **k: _假回(
                '{"data":[{"id":"甲-free"},{"id":"付费款"},{"id":"新付费"}]}')
            拉 = 问模型清单("拉单家", 库=库)
        finally:
            urllib.request.urlopen = 原开
        assert 拉["清单"] == [], f"免费款藏光了也得滤掉收费的:{拉['清单']}"
        c拉 = 连库(库)
        assert c拉.execute("SELECT 清单于 FROM 供应商 WHERE 名='拉单家'").fetchone()[0], \
            "拉清单成功得记下清单于(模型更新页「上次检查」读它,巡检也算)"
        c拉.close()
        assert 拉["不认了"] == ["老款", "旧免费-free"], f"不认了只算服务端没列的:{拉['不认了']}"
        c拉 = 连库(库)
        剩 = {r["模型"] for r in c拉.execute("SELECT 模型 FROM 模型笔记 WHERE 供应商='拉单家'")}
        c拉.close()
        assert "甲-free" in 剩, "藏着且服务端还列着的免费款得留着(取消隐藏还要用)"
        assert "旧免费-free" not in 剩 and "付费款" not in 剩, f"失效的 / 收费的旧行该清掉:{剩}"
        assert _对得上前缀("DeepSeek-V4-Flash", ["deepseek"]), "大小写不该影响归属"
        assert _对得上前缀("gpt-5.5", ["GPT"]), "前缀那边大写也一样"

        加供应商("巡家", "网页接口", "http://xj/v1/chat/completions", "在用款,下架款", 库=库)
        加供应商("巡订阅家", "网页接口", "http://xd/v1/chat/completions", "订款", 库=库)
        加供应商("巡画家", "网页接口", "http://xh/v1/images/generations", "画款", 库=库)
        for 名 in ("巡家", "巡订阅家", "巡画家"):
            设密钥(名, "k", 库=库)
        设吃订阅("巡订阅家", True, 库=库)
        设同意("巡订阅家", True, 库=库)
        加功能("巡测 · 在用", "文本", "巡家", "在用款", 库=库)
        加功能("巡测 · 拨下架", "文本", "巡家", "下架款", 库=库)
        加功能("巡测 · 关着", "文本", "巡家", "关着款", 库=库)
        加功能("巡测 · 野款", "文本", "巡家", "野款", 库=库)
        设启用("巡测 · 关着", False, 库=库)
        加功能("巡测 · 订阅", "文本", "巡订阅家", "订款", 库=库)
        加功能("巡测 · 画", "生图", "巡画家", "画款", 库=库)
        拉过, 测过 = [], []
        def 假开(请求, *a, **k):
            拉过.append(请求.full_url)
            return _假回('{"data":[{"id":"在用款"},{"id":"订款"},{"id":"新款"}]}')
        def 假发(地址, *a, **k):
            测过.append(地址)
            return "收到"
        原开, 原发网页 = urllib.request.urlopen, _发网页请求
        try:
            urllib.request.urlopen = 假开
            globals()["_发网页请求"] = 假发
            巡 = 巡检(库=库)
        finally:
            urllib.request.urlopen = 原开
            globals()["_发网页请求"] = 原发网页
        assert not any("xh" in u for u in 拉过), f"生图那条地址不许自动拉清单:{拉过}"
        assert any("xj/v1/models" in u for u in 拉过) and any("xd/v1/models" in u for u in 拉过), \
            f"聊天口的家(吃订阅的也算,列清单不烧额度)都该拉:{拉过}"
        巡家那条 = [x for x in 巡["拉"] if x.get("家") == "巡家"][0]
        assert 巡家那条["新来"] == ["订款", "新款"] and 巡家那条["不认了"] == ["下架款"], 巡家那条
        assert [x for x in 巡["在用不列了"] if x["家"] == "巡家"] == \
            [{"家": "巡家", "模型": "下架款", "功能": ["巡测 · 拨下架"]},
             {"家": "巡家", "模型": "野款", "功能": ["巡测 · 野款"]}], \
            f"在用却不在服务端清单里的都得点名(没进过旧清单的也算):{巡['在用不列了']}"
        测的 = {(x["家"], x["模型"]) for x in 巡["测"]}
        assert ("巡家", "在用款") in 测的 and ("巡家", "下架款") in 测的, f"在用的非订阅模型都得真测:{测的}"
        assert ("巡家", "关着款") not in 测的, "关着的功能不测"
        assert not any(x[0] in ("巡订阅家", "巡画家") for x in 测的), f"吃订阅的、生图的不许真测:{测的}"
        assert all("xd" not in u and "xh" not in u for u in 测过), f"真发出去的请求里混进了不该测的:{测过}"
        assert any(x["家"] == "巡订阅家" and "吃订阅" in x["为什么"] for x in 巡["跳过"]), 巡["跳过"]
        c巡 = 连库(库)
        assert c巡.execute("SELECT 连通 FROM 模型笔记 WHERE 供应商='巡家' AND 模型='在用款'"
                          ).fetchone()[0] == "通", "测出来的结果得落进「连通」格"
        c巡.close()
        def 炸开(请求, *a, **k):
            raise OSError("连不上")
        try:
            urllib.request.urlopen = 炸开
            globals()["_发网页请求"] = 假发
            巡 = 巡检(库=库)
        finally:
            urllib.request.urlopen = 原开
            globals()["_发网页请求"] = 原发网页
        assert any("错" in x for x in 巡["拉"]) and 巡["测"], f"拉清单出错也得接着测:{巡}"

        加供应商("测 · 全档家", "网页接口", "https://api.example.com/v1/chat/completions",
              "m一,m二,m三", 库=库)
        加功能("测 · 一条口", "文本", "测 · 全档家", "m一", 库=库)
        加功能("测 · 一条口 · 人起的名", "文本", "测 · 全档家", "m一", 库=库)
        r = 设档("测 · 一条口", ["测 · 全档家/m一"], 库=库)
        assert len(r["新建"]) == 1 and not r["删掉"], f"挑一个该建一档:{r}"
        assert r["新建"][0] == "测 · 一条口 · 测 · 全档家/m一", f"档名不对:{r['新建'][0]}"
        建出的 = {x["功能名"]: x for x in 读配置(库=库)["功能"]}
        assert 建出的["测 · 一条口 · 测 · 全档家/m一"]["主用模型"] == "m一", "每一档拨给它自己那个模型"
        assert all(x.startswith("测 · 一条口") for x in r["新建"]), "建出来的档名必须以族名开头"
        assert 列口("测 · 一条口", 库=库)["挑中"] == ["测 · 全档家/m一"], \
            "列口 得报得出现在挑中了哪几个(面板的勾就是照它打的)"
        assert 列口("测 · 一条口", 库=库)["手工的"] == ["测 · 一条口 · 人起的名"], \
            "手工起名的那档要单独报出来 —— 面板上得让人看见它在,但不归这颗钮管"
        for 试, 该报 in ((lambda: 设档("测 · 一条口",
                                     ["测 · 全档家/m一", "测 · 全档家/m二"], 库=库), "最多摆 3 个"),
                       (lambda: 加备选("测 · 一条口", "测 · 全档家", "m三", 库=库), "最多摆 3 个")):
            try:
                试()
                raise AssertionError("超上限该被拦下")
            except 底座错误 as e:
                assert 该报 in str(e), f"拦下来得给人话:{e}"
        assert len([x for x in 读配置(库=库)["功能"]
                    if x["功能名"].startswith("测 · 一条口")]) == 3, "拦下来不许留下半拉行"

        r2 = 设档("测 · 一条口", ["测 · 全档家/m二"], 库=库)
        assert r2["删掉"] == ["测 · 一条口 · 测 · 全档家/m一"], f"取消勾的那档该删掉:{r2}"
        assert r2["新建"] == ["测 · 一条口 · 测 · 全档家/m二"], f"新勾的那档该建出来:{r2}"
        设档("测 · 一条口", ["测 · 全档家/m一"], 库=库)
        r2 = 设档("测 · 一条口", ["测 · 全档家/m一"], 库=库)
        assert not r2["新建"] and r2["已有"], f"还勾着的不许重建:{r2}"
        剩 = {x["功能名"] for x in 读配置(库=库)["功能"]}
        assert "测 · 一条口 · 测 · 全档家/m二" not in 剩, "删完就不该再查得到"
        assert "测 · 一条口" in 剩, "族名那一行是出厂档,一次都不许删 —— 删了应用端一档都没有"
        assert "测 · 一条口 · 人起的名" in 剩, "人手工起名的档不归它管,一个字不许动"
        assert "示例 · 生成" in 剩 and "示例 · 润色" in 剩, "别的口的行一律不许碰"

        加功能("测 · 没族名行 · 甲", "文本", "测 · 全档家", "m一", 库=库)
        加功能("测 · 没族名行 · 乙", "文本", "测 · 全档家", "m二", 库=库)
        assert not [x for x in 读配置(库=库)["功能"] if x["功能名"] == "测 · 没族名行"], \
            "这一族故意不建族名行 —— 要验的就是它不在时怎么数"
        加备选("测 · 没族名行", "测 · 全档家", "m三", "丙", 库=库)
        assert len([x for x in 读配置(库=库)["功能"]
                    if x["功能名"].startswith("测 · 没族名行")]) == 3, "第三个该存得进去"
        try:
            加备选("测 · 没族名行", "测 · 全档家", "m三", "丁", 库=库)
            raise AssertionError("满 3 个之后还该拦")
        except 底座错误 as e:
            assert "最多摆 3 个" in str(e), f"拦下来得给人话:{e}"

        r3 = 设档("测 · 一条口", [], 库=库)
        assert r3["删掉"] == ["测 · 一条口 · 测 · 全档家/m一"], f"全不勾该清光自动档:{r3}"
        剩3 = {x["功能名"] for x in 读配置(库=库)["功能"]}
        assert "测 · 一条口" in 剩3 and "测 · 一条口 · 人起的名" in 剩3, "清光的只是自动建的那些"

        for 口名, 单, 该报 in [("", ["测 · 全档家/m一"], "哪条口"),
                          ("测 · 一条口", ["根本没这家/m一"], "供应商表里没有"),
                          ("测 · 一条口", ["没写斜杠"], "家/模型")]:
            try:
                设档(口名, 单, 库=库)
                raise AssertionError(f"({口名},{单}) 该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"
        assert not any(x["功能名"].startswith("测 · 一条口 · 根本没这家")
                       for x in 读配置(库=库)["功能"]), "参数不合格时不许留下半拉行"

        设档("测 · 一条口", ["测 · 全档家/m三"], 库=库)
        assert 删功能("测 · 一条口 · 测 · 全档家/m三", 库=库), "点名那一行该删得掉"
        剩下 = {x["功能名"] for x in 读配置(库=库)["功能"]}
        assert "测 · 一条口 · 测 · 全档家/m三" not in 剩下, "删完就不该再查得到"
        assert "测 · 一条口 · 人起的名" in 剩下, "只许删点名那一行,别的档不许跟着没"
        assert not 删功能("根本没这一行", 库=库), "本来就没有的回 False,不报错"
        try:
            删功能("", 库=库)
            raise AssertionError("功能名空着该报人话")
        except 底座错误 as e:
            assert "删哪一行" in str(e), f"报错内容不对:{e}"
        assert 设档("测 · 一条口", ["测 · 全档家/m三"], 库=库)["新建"] == \
            ["测 · 一条口 · 测 · 全档家/m三"], "删掉的那一档,再挑一次该补得回来"

        加供应商("测 · 待删家", "网页接口", "http://127.0.0.1:1/v1/chat/completions", "m甲,m乙", 库=库)
        记笔记("测 · 待删家", "m甲", 备注="删家时这条该跟着走", 库=库)
        assert 删供应商("测 · 待删家", 库=库), "没人用的那一家该删得掉"
        assert not any(x["名"] == "测 · 待删家" for x in 读配置(库=库)["供应商"]), "删完就不该再查得到"
        加供应商("测 · 待删家", "网页接口", "http://127.0.0.1:1/v1/chat/completions", "m甲", 库=库)
        又建的 = next(x for x in 读配置(库=库)["供应商"] if x["名"] == "测 · 待删家")
        assert 又建的["模型笔记"] == [], f"家删了,它的模型笔记得跟着走:{又建的['模型笔记']}"
        删供应商("测 · 待删家", 库=库)
        加供应商("测 · 用着的家", "网页接口", "http://127.0.0.1:1/v1/chat/completions", "m甲", 库=库)
        加功能("测 · 占着这家", "文本", "测 · 用着的家", "m甲", 库=库)
        try:
            删供应商("测 · 用着的家", 库=库)
            raise AssertionError("还有功能拨给它的时候不许删掉")
        except 底座错误 as e:
            assert ("1 条功能" in str(e) and "测 · 占着这家" in str(e)
                    and "改选别家" in str(e)), f"拒绝的话得说清是哪几条、去哪儿改:{e}"
        assert any(x["名"] == "测 · 用着的家" for x in 读配置(库=库)["供应商"]), "拒绝之后那一家得原样还在"
        删功能("测 · 占着这家", 库=库)
        assert 删供应商("测 · 用着的家", 库=库), "把功能改走之后就该删得动了"
        assert not 删供应商("根本没这一家", 库=库), "本来就没有的回 False,不报错"
        try:
            删供应商("", 库=库)
            raise AssertionError("家名空着该报人话")
        except 底座错误 as e:
            assert "删哪一家" in str(e), f"报错内容不对:{e}"

        设档("测 · 一条口", [], 库=库)
        新名 = 加备选("测 · 一条口", "测 · 全档家", "m二", "更会写但慢", 库=库)
        assert 新名 == "测 · 一条口 · 更会写但慢", f"人自己起的名该原样用上:{新名}"
        加出的 = {x["功能名"]: x for x in 读配置(库=库)["功能"]}[新名]
        assert (加出的["主用供应商"], 加出的["主用模型"]) == ("测 · 全档家", "m二"), "拨给挑的那一家那个模型"
        assert 加出的["种类"] == "文本", "种类得跟着这条口走,不许自己另立一个"
        assert 列口("测 · 一条口", 库=库)["手工的"] == ["测 · 一条口 · 人起的名", 新名], \
            "起了名字的行归「手工的」,自动那套一律不碰它"
        删功能(新名, 库=库)
        无名 = 加备选("测 · 一条口", "测 · 全档家", "m二", 库=库)
        assert 无名 == "测 · 一条口 · 测 · 全档家/m二", f"没起名字就用「家/模型」:{无名}"
        for 参, 该报 in ((("", "测 · 全档家", "m二", ""), "要说清楚"),
                       (("测 · 一条口", "根本没这家", "m二", ""), "供应商表里没有"),
                       (("测 · 一条口", "测 · 全档家", "m二", "带/斜杠"), "不能有斜杠"),
                       (("测 · 一条口", "测 · 全档家", "m二", ""), "已经有")):
            try:
                加备选(*参, 库=库)
                raise AssertionError(f"{参} 该报错却没报")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错内容不对:{e}"

        删功能("测 · 没族名行 · 丙", 库=库)
        自动名 = 加备选("测 · 没族名行", "测 · 全档家", "m三", 库=库)
        assert 自动名 == "测 · 没族名行 · 测 · 全档家/m三", f"自动档名不对:{自动名}"
        爹们 = {x["功能名"]: x["父功能"] for x in 读配置(库=库)["功能"]}
        assert 爹们[自动名] == "测 · 没族名行", \
            f"家名里带「 · 」时,爹也得是挂进去的那条口,不许砍名字砍出来一个:{爹们[自动名]}"
        assert 爹们["测 · 没族名行 · 甲"] == "测 · 没族名行", "族名那一行不在库里,爹照样是那条口"
        assert 爹们["测 · 一条口"] == "" and 爹们["示例 · 生成"] == "", \
            "头行自己没有爹 —— 空 = 它就是一条口"
        assert 爹们["测 · 一条口 · 人起的名"] == "测 · 一条口", "手工起名那一档归它上头那条口"
        那条口 = 列口("测 · 没族名行", 库=库)
        assert 那条口["挑中"] == ["测 · 全档家/m三"], f"挑中那几档按名字前缀数,跟改前一样:{那条口}"
        assert set(那条口["手工的"]) == {"测 · 没族名行 · 甲", "测 · 没族名行 · 乙"}, \
            f"人起名的那几档也一样:{那条口}"

        老 = os.path.join(d, "老库.db")
        c0 = sqlite3.connect(老)
        c0.execute("CREATE TABLE 功能 (功能名 TEXT PRIMARY KEY, 主用供应商 TEXT, 主用模型 TEXT)")
        for 名 in ("示例 · 生成", "示例 · 生成 · CPA 反代 · Gemini 生图/g-1",
                  "示例 · 单格改写 · 便宜快"):
            c0.execute("INSERT INTO 功能(功能名) VALUES(?)", (名,))
        c0.commit()
        c0.close()
        conn = 连库(老)
        老爹 = {r["功能名"]: r["父功能"] for r in conn.execute("SELECT 功能名,父功能 FROM 功能")}
        conn.close()
        assert 老爹["示例 · 生成"] == "", "头行升上来该是空的(它自己就是一条口)"
        assert 老爹["示例 · 生成 · CPA 反代 · Gemini 生图/g-1"] == "示例 · 生成", \
            "取库里真有的**最长**前缀 —— 砍名字会砍出「示例 · 生成 · CPA 反代」这个不存在的组"
        assert 老爹["示例 · 单格改写 · 便宜快"] == "示例 · 单格改写", \
            "头行不在库里的,填砍最后一截那个名字(2026-09-04 定:面板上那一组的标题维持现状)"
        conn = 连库(老)
        assert conn.execute("SELECT COUNT(*) FROM 功能 WHERE 父功能 IS NULL").fetchone()[0] == 0, \
            "第二次连库不该再有没算过的行"
        conn.close()

        assert _理历史(None) == [] and _理历史([]) == [], "不给历史 = 空列表,不是报错"
        assert _理历史({"role": "user", "content": "一"}) == [{"role": "user", "content": "一"}], \
            "只给一条时不用包成列表(跟 参考图 同一个脾气)"
        for 坏, 该报 in ((["光一句话"], "不是一个字典"),
                      ([{"role": "system", "content": "x"}], "只认 user 或 assistant"),
                      ([{"role": "user"}], "content 是空的"),
                      ([{"role": "user", "content": "   "}], "content 是空的"),
                      ([{"role": "user", "content": 7}], "content 是空的")):
            try:
                _理历史(坏)
                raise AssertionError(f"{坏!r} 该被拦下")
            except 底座错误 as e:
                assert 该报 in str(e), f"报错该说清是哪儿不对,实得:{e}"

        加功能("测 · 多轮", "文本", "DeepSeek", "m", 库=库)
        往来 = [{"role": "user", "content": "我想做番茄炒蛋"},
              {"role": "assistant", "content": "放几个鸡蛋?"}]
        原网页2, 收到 = _发网页请求, {}

        def 假网页2(地址, 密钥, 载荷, 超时, 收=None):
            收到["载荷"] = 载荷
            return "好"
        try:
            globals()["_发网页请求"] = 假网页2
            问("测 · 多轮", "总指令", "三个", 历史=往来, 库=库)
        finally:
            globals()["_发网页请求"] = 原网页2
        角们 = [m["role"] for m in 收到["载荷"]["messages"]]
        assert 角们 == ["system", "user", "assistant", "user"], \
            f"顺序该是 system → 前面聊过的 → 这一次要说的,实得 {角们}"
        assert 收到["载荷"]["messages"][1]["content"] == "我想做番茄炒蛋", "历史得原样递上去"
        assert 收到["载荷"]["messages"][-1]["content"] == "三个", "最后那条才是这一次要说的"
        try:
            globals()["_发网页请求"] = 假网页2
            问("测 · 多轮", "总指令", "只此一句", 库=库)
        finally:
            globals()["_发网页请求"] = 原网页2
        assert [m["role"] for m in 收到["载荷"]["messages"]] == ["system", "user"], \
            "不给历史就该还是两条,别自己加料"

        摊 = _摊平历史(往来, "三个")
        assert 摊.startswith(_摊平头) and _摊平尾 in 摊, "摊平要有头有尾,模型才分得清哪句是这一次问的"
        assert "我:我想做番茄炒蛋" in 摊 and "你:放几个鸡蛋?" in 摊, "两个说话人得分开标"
        assert 摊.rstrip().endswith("三个"), "这一次要说的必须在最后"
        assert _摊平历史([], "只此一句") == "只此一句", "没历史时一个字都不许加"
        收到2 = {}
        原命令行2 = _发命令行请求
        try:
            globals()["_发命令行请求"] = lambda 可执行, 模型, system, user, *a, **k: (
                收到2.setdefault("user", user), 收到2.setdefault("system", system), "好")[-1]
            设路由("测 · 多轮", _测CL, "sonnet", 库=库)
            问("测 · 多轮", "总指令", "三个", 历史=往来, 库=库)
        finally:
            globals()["_发命令行请求"] = 原命令行2
        assert _摊平头 in 收到2["user"] and "我想做番茄炒蛋" in 收到2["user"], \
            f"命令行那条也得把历史带上,实得:{收到2['user'][:80]}"
        assert 收到2["system"] == "总指令", "总指令照旧走 system,不许被历史挤进去"
        删功能("测 · 多轮", 库=库)

        降库 = os.path.join(d, "降级.db")
        c降 = 连库(降库)
        c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,父功能) "
                   "VALUES('测 · 降级','DeepSeek','主模型','文本','')")
        for 名, 开 in (("测 · 降级 · 备一", 1), ("测 · 降级 · 备二", 1), ("测 · 降级 · 关着的", 0)):
            c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,启用,父功能) "
                       "VALUES(?,'DeepSeek',?,'文本',?,'测 · 降级')", (名, 名[-2:], 开))
        c降.commit()
        主行 = c降.execute("SELECT * FROM 功能 WHERE 功能名='测 · 降级'").fetchone()
        主供 = c降.execute("SELECT * FROM 供应商 WHERE 名='DeepSeek'").fetchone()
        备 = [r["功能名"] for r in _降级候选(c降, 主行, "文本")]
        assert 备 == ["测 · 降级 · 备一", "测 · 降级 · 备二"], f"关掉的那行不许进候选:{备}"
        assert _降级候选(c降, 主行, "生图") == [], "种类不一样的不许进候选"

        def 造错(码):
            e = 底座错误(f"HTTPError: {码}")
            e.原因 = urllib.error.HTTPError("u", 码, "x", {}, None)
            return e

        跑过 = []
        def 跑一趟(行, 供):
            跑过.append(行["功能名"])
            if 行["功能名"] != "测 · 降级 · 备二":
                raise 造错(503)
            return "备二答的"
        assert _轮着试(c降, 主行, 主供, "文本", 跑一趟) == "备二答的", "503 该一路降到能用的那一档"
        assert 跑过 == ["测 · 降级", "测 · 降级 · 备一", "测 · 降级 · 备二"], \
            f"该按顺序一行一行往下试:{跑过}"
        跑过.clear()
        try:
            _轮着试(c降, 主行, 主供, "文本", lambda 行, 供: (跑过.append(行["功能名"]),
                                                    (_ for _ in ()).throw(造错(401)))[0])
            raise AssertionError("401 该当场报错")
        except 底座错误 as e:
            assert "401" in str(e)
        assert 跑过 == ["测 · 降级"], f"401 不许往下降:{跑过}"
        try:
            _轮着试(c降, 主行, 主供, "文本",
                  lambda 行, 供: (_ for _ in ()).throw(造错(503 if 行["功能名"] == "测 · 降级" else 500)))
            raise AssertionError("全挂了该抛")
        except 底座错误 as e:
            assert "503" in str(e), f"该报第一次那个错,报的是:{e}"
        assert _换得了吗(造错(503)) and _换得了吗(造错(429)), "5xx 与 429 换一家有救"
        assert not _换得了吗(造错(401)) and not _换得了吗(底座错误("密钥没填")), \
            "请求本身不对 / 配置没配好的,不许降级"
        c降.close()

        import io
        加供应商("测 · 降图家", "网页接口", "http://127.0.0.1:1/v1/images/generations", "主图", 库=降库)
        设密钥("测 · 降图家", "sk-x", 库=降库)
        设同意("测 · 降图家", True, 库=降库)
        加功能("测 · 降图", "生图", "测 · 降图家", "主图", 库=降库)
        c降 = 连库(降库)
        c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,启用,父功能) "
                   "VALUES('测 · 降图 · 备一','测 · 降图家','备图','生图',1,'测 · 降图')")
        c降.commit()
        c降.close()
        冷却体 = ('{"error":{"code":"model_cooldown","message":"All credentials for model 主图 are cooling down",'
                '"reset_seconds":165618,"reset_time":"46h0m17s"}}')
        打过: list = []
        def 假生图(网址, 钥, 载, 类型, 时):
            打过.append(载.get("model") if isinstance(载, dict) else 载)
            if 打过[-1] == "主图":
                raise urllib.error.HTTPError(网址, 429, "Too Many Requests", {},
                                             io.BytesIO(冷却体.encode("utf-8")))
            return b"PNG", "image/png"
        原发生图, 原限速降 = _发生图请求, _限速
        try:
            globals()["_发生图请求"], globals()["_限速"] = 假生图, (lambda *a, **k: None)
            try:
                画图("测 · 降图", "一只猫", 换备选=False, 库=降库)
                raise AssertionError("换备选=False、首选回 429 该当场抛错")
            except 底座错误 as e:
                assert "429" in str(e) and '"reset_time":"46h0m17s"' in str(e), \
                    f"该原样带着上游原文(站里从里头算恢复时刻):{e}"
            assert 打过 == ["主图"], f"换备选=False 备选一行都不许调:{打过}"
            日 = [(r["功能"], bool(r["成没成"])) for r in
                 连库(降库).execute("SELECT 功能, 成没成 FROM 日志 WHERE 功能 LIKE '测 · 降图%'")]
            assert 日 == [("测 · 降图", False)], f"首选那一趟照旧进日志,备选不该有记录:{日}"
            打过.clear()
            assert 画图("测 · 降图", "一只猫", 库=降库) == (b"PNG", "image/png"), "不传开关该照旧换到备选"
            assert 打过 == ["主图", "备图"], f"不传开关该先打首选、再换备选:{打过}"
        finally:
            globals()["_发生图请求"], globals()["_限速"] = 原发生图, 原限速降

        加供应商("测 · 审网页", "网页接口", "http://127.0.0.1:1/v1/chat/completions", "主", 库=降库)
        设密钥("测 · 审网页", "sk-x", 库=降库)
        设同意("测 · 审网页", True, 库=降库)
        加供应商("测 · 审命令行", "命令行", "claude", "sonnet", 库=降库)
        设同意("测 · 审命令行", True, 库=降库)
        加功能("测 · 审文", "文本", "测 · 审网页", "主", 库=降库)
        加功能("测 · 审命", "文本", "测 · 审命令行", "sonnet", 库=降库)
        c降 = 连库(降库)
        for 名, 父 in (("测 · 审文 · 备", "测 · 审文"), ("测 · 审命 · 备", "测 · 审命")):
            c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,启用,父功能) "
                       "VALUES(?,'测 · 审网页','备','文本',1,?)", (名, 父))
        c降.commit()
        c降.close()
        网页打过: list = []
        网页回: dict = {}
        def 假网页(地, 钥, 载, 时, 收=None):
            网页打过.append(载["model"])
            做 = 网页回[载["model"]]
            if isinstance(做, int):
                raise urllib.error.HTTPError(地, 做, "x", {},
                                             io.BytesIO(b'{"error":{"message":"image upstream busy"}}'))
            return 做
        def 审成败(功能名):
            return [bool(r["成没成"]) for r in 连库(降库).execute(
                "SELECT 成没成 FROM 日志 WHERE 功能=? ORDER BY rowid", (功能名,))]
        原发网页审, 原限速审, 原run审 = _发网页请求, _限速, subprocess.run
        try:
            globals()["_发网页请求"], globals()["_限速"] = 假网页, (lambda *a, **k: None)
            for 码 in (429, 503):
                网页打过.clear()
                网页回.update({"主": 码, "备": "备答了"})
                assert 问("测 · 审文", "s", "u", 参考图=_纯色图(), 重试=0, 库=降库) == "备答了", \
                    f"带图撞上 {码} 该换备选"
                assert 网页打过 == ["主", "备"], f"带图 {码} 该先主后备:{网页打过}"
            网页打过.clear()
            网页回.update({"主": 400})
            try:
                问("测 · 审文", "s", "u", 参考图=_纯色图(), 重试=0, 库=降库)
                raise AssertionError("带图 400 该当场报错")
            except 底座错误 as e:
                assert "设置面板" in str(e), f"带图 400 得补中文出路:{e}"
            assert 网页打过 == ["主"], f"带图 400 不许换备选:{网页打过}"
            for 空 in (None, "", "   "):
                网页打过.clear()
                网页回.update({"主": 空, "备": "备答了"})
                前 = len(审成败("测 · 审文"))
                assert 问("测 · 审文", "s", "u", 重试=0, 库=降库) == "备答了", f"主回 {空!r} 该换备选"
                assert 网页打过 == ["主", "备"], f"主回 {空!r} 该先主后备:{网页打过}"
                assert 审成败("测 · 审文")[前:] == [False], f"主回 {空!r} 日志该记败:{审成败('测 · 审文')[前:]}"
            网页打过.clear()
            网页回.update({"主": None})
            try:
                问("测 · 审文", "s", "u", 重试=1, 换备选=False, 库=降库)
                raise AssertionError("空回复、不换备选该当场抛错")
            except 底座错误 as e:
                assert "没回正文" in str(e) and isinstance(e.原因, 答非所问), f"该说清没回正文:{e}"
            assert 网页打过 == ["主", "主"], f"空回复该算「再问一次多半就好」,重试 1 = 打两次:{网页打过}"
            网页打过.clear()
            网页回.update({"主": None, "备": '{"a": 1}'})
            assert 问JSON("测 · 审文", "s", "u", 重试=0, 库=降库) == {"a": 1}, "要 JSON 时主回 None 也该换备选"

            命令行次数: list = []
            命令行回: dict = {}
            def 假run审(命令, **kw):
                命令行次数.append(1)
                class R:
                    returncode = 1
                    stdout = json.dumps({"type": "result", "is_error": True, "result": 命令行回["话"]})
                    stderr = ""
                return R()
            subprocess.run = 假run审
            for 话, 码 in (("API Error: 429 {\"type\":\"error\"}", 429),
                          ("API Error: 529 {\"type\":\"overloaded_error\"}", 529)):
                命令行回["话"] = 话
                try:
                    _发命令行请求("claude", "sonnet", "s", "u", False, 60)
                    raise AssertionError("退出码 1 该抛")
                except 上游报码 as e:
                    assert e.码 == 码 and 话[:15] in str(e), f"该认出状态码 {码}、原话留着:{e}"
                命令行次数.clear()
                网页打过.clear()
                网页回.update({"备": "备答了"})
                assert 问("测 · 审命", "s", "u", 重试=0, 库=降库) == "备答了", f"命令行 {码} 该换备选"
                assert len(命令行次数) == 1 and 网页打过 == ["备"], f"命令行 {码} 先打一次再换:{命令行次数} {网页打过}"
            命令行回["话"] = "API Error: 503 upstream"
            命令行次数.clear()
            try:
                问("测 · 审命", "s", "u", 重试=1, 换备选=False, 库=降库)
                raise AssertionError("命令行 503、不换备选该抛")
            except 底座错误:
                pass
            assert len(命令行次数) == 2, f"命令行 503 重试 1 该打两次:{len(命令行次数)}"
            for 话 in ("API Error: 400 bad model", "API Error: 401 auth", "出了点事 API Error: 429 在中间",
                      "Request timed out"):
                命令行回["话"] = 话
                命令行次数.clear()
                网页打过.clear()
                try:
                    问("测 · 审命", "s", "u", 重试=1, 库=降库)
                    raise AssertionError(f"「{话}」该当场报错")
                except 底座错误:
                    pass
                assert len(命令行次数) == 1 and 网页打过 == [], \
                    f"「{话}」不许重试、不许换备选:{len(命令行次数)} {网页打过}"
        finally:
            globals()["_发网页请求"], globals()["_限速"] = 原发网页审, 原限速审
            subprocess.run = 原run审

        加供应商("测 · 限甲", "网页接口", "https://a.invalid/v1/chat/completions", "甲", 库=降库)
        加供应商("测 · 限乙", "网页接口", "https://b.invalid/v1/chat/completions", "乙", 库=降库)
        for 家 in ("测 · 限甲", "测 · 限乙"):
            设密钥(家, "sk-x", 库=降库)
            设同意(家, True, 库=降库)
        设限速("测 · 限甲", 0, 1, 库=降库)
        设限速("测 · 限乙", 0, 1, 库=降库)
        加功能("测 · 限换", "文本", "测 · 限甲", "甲", 库=降库)
        c降 = 连库(降库)
        c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,启用,父功能) "
                   "VALUES('测 · 限换 · 备','测 · 限乙','乙','文本',1,'测 · 限换')")
        c降.commit()
        c降.close()
        限打过: list = []
        原发网页限 = _发网页请求
        try:
            globals()["_发网页请求"] = lambda 地, 钥, 载, 时, 收=None: (限打过.append(载["model"]),
                                                               载["model"] + "答的")[-1]
            assert 问("测 · 限换", "s", "u", 重试=0, 库=降库) == "甲答的"
            回: dict = {}
            assert 问("测 · 限换", "s", "u", 重试=0, 回执=回, 库=降库) == "乙答的", "首选撞上限该换到备选"
            assert 限打过 == ["甲", "乙"], f"撞上限那次一个字节不许发:{限打过}"
            assert 回["换过备选"] and "上限" in 回["首选错误"], f"回执该摆出因上限换家:{回}"
            日 = [(r["功能"], bool(r["成没成"])) for r in 连库(降库).execute(
                "SELECT 功能, 成没成 FROM 日志 WHERE 功能 LIKE '测 · 限换%' ORDER BY rowid")]
            assert 日 == [("测 · 限换", True), ("测 · 限换 · 备", True)], f"日志该两行各记各的:{日}"
            try:
                问("测 · 限换", "s", "u", 重试=0, 换备选=False, 库=降库)
                raise AssertionError("换备选=False 撞上限该当场抛")
            except 撞上限:
                pass
            限打过.clear()
            try:
                问("测 · 限换", "s", "u", 重试=0, 库=降库)
                raise AssertionError("首选备选都撞上限该抛")
            except 撞上限 as e:
                assert "测 · 限甲" in str(e), f"该报首选那句上限:{e}"
            assert 限打过 == [], f"两家都满,一个字节不许发:{限打过}"
        finally:
            globals()["_发网页请求"] = 原发网页限

        原打截, 原run截 = _打, subprocess.run
        截打过: list = []
        try:
            def 假打截(地, 钥, 载, 时, 收=None):
                截打过.append(载["model"])
                return {"choices": [{"message": {"content": "第七页写到一半"}, "finish_reason": "length"}]}
            globals()["_打"] = 假打截
            设限速("测 · 限甲", 0, 0, 库=降库)
            设限速("测 · 限乙", 0, 0, 库=降库)
            前 = len(审成败("测 · 限换"))
            try:
                问("测 · 限换", "s", "u", 重试=1, 库=降库)
                raise AssertionError("finish_reason=length 该报错")
            except 回话截断 as e:
                assert "截断" in str(e) and "8192" in str(e), f"该说清被截断:{e}"
            assert 截打过 == ["甲"], f"被截断不许重试、不许换备选:{截打过}"
            assert 审成败("测 · 限换")[前:] == [False], "被截断日志该记败"
            globals()["_打"] = lambda 地, 钥, 载, 时, 收=None: {
                "choices": [{"message": {"content": "好"}, "finish_reason": "stop"}]}
            assert 问("测 · 限换", "s", "u", 重试=0, 库=降库) == "好", "正常停的照旧交回去"
            class R截:
                returncode = 0
                stdout = json.dumps({"type": "result", "result": "半截", "stop_reason": "max_tokens"})
                stderr = ""
            subprocess.run = lambda 命令, **kw: R截()
            try:
                _发命令行请求("claude", "sonnet", "s", "u", False, 60)
                raise AssertionError("命令行 stop_reason=max_tokens 该报错")
            except 回话截断:
                pass
            R截.stdout = json.dumps({"type": "result", "result": "全的", "stop_reason": "end_turn"})
            assert _发命令行请求("claude", "sonnet", "s", "u", False, 60) == "全的"
        finally:
            globals()["_打"], subprocess.run = 原打截, 原run截
        for 体 in ({"data": [{"b64_json": base64.b64encode(b"not-an-image").decode()}]},
                   {"candidates": [{"content": {"parts": [{"inlineData": {
                       "mimeType": "image/png", "data": base64.b64encode(b"<html>").decode()}}]}}]}):
            try:
                _取图(体, 5)
                raise AssertionError(f"{str(体)[:80]} 该报错")
            except 答非所问 as e:
                assert "不是认得出的图片" in str(e), f"报错得说清:{e}"
        assert _值得重试(答非所问("x")) and _换得了吗(答非所问("x")), "坏图 / 空回复该能重试、能换备选"

        c降 = 连库(降库)
        设用力("测 · 降级", "high", 库=降库)
        前 = 对调设定("测 · 降级", "测 · 降级 · 备一", 库=降库)
        取行 = lambda n: 连库(降库).execute("SELECT * FROM 功能 WHERE 功能名=?", (n,)).fetchone()
        assert 取行("测 · 降级")["主用模型"] == "备一", f"首选那一行该拿到备选的模型:{前}"
        assert 取行("测 · 降级 · 备一")["主用模型"] == "主模型", "备选那一行该拿到原来首选的"
        assert 取行("测 · 降级 · 备一")["用力"] == "high", "推理强度也跟着换过去"
        assert 取行("测 · 降级")["功能名"] == "测 · 降级", "名字是接入方认的主键,一个字都不许动"
        for 甲, 乙 in (("测 · 降级", "示例 · 生成"), ("测 · 降级", "测 · 降级")):
            try:
                对调设定(甲, 乙, 库=降库)
                raise AssertionError(f"({甲}, {乙}) 该被拦下")
            except 底座错误:
                pass

        族序 = _族序(c降, "测 · 降级")
        assert 族序[0] == "测 · 降级" and len(族序) == 4, f"头行在最前、四行都在:{族序}"
        assert 族序[1:] == [r[0] for r in c降.execute(
            f"SELECT 功能名 FROM 功能 WHERE 父功能='测 · 降级' ORDER BY {_族内序}")], \
            "面板上下顺序必须就是 _降级候选 那个 ORDER BY"
        末行, 倒二 = 族序[-1], 族序[-2]
        末模 = 取行(末行)["主用模型"]; 倒二模 = 取行(倒二)["主用模型"]
        出 = 挪一格(末行, "上", 库=降库)
        assert 出["换到"] == 倒二, f"上移该跟上一行换:{出}"
        assert 取行(倒二)["主用模型"] == 末模 and 取行(末行)["主用模型"] == 倒二模, "模型该对调过去"
        assert _族序(连库(降库), "测 · 降级") == 族序, "手起的名挪完不许变、位置不许跳"
        for 名, 向 in (("测 · 降级", "上"), (末行, "下"), ("测 · 降级", "斜")):
            try:
                挪一格(名, 向, 库=降库)
                raise AssertionError(f"({名}, {向}) 该被拦下")
            except 底座错误:
                pass

        列 = 族("测 · 降级", 库=降库)
        assert [x["功能名"] for x in 列] == _族序(连库(降库), "测 · 降级"), "族() 的顺序只许是 _族序()"
        assert 族(末行, 库=降库) == 列, "给备选行也该回整族"
        assert set(列[0]) == {"功能名", "供应商", "模型", "推理强度", "启用"}, f"字段不对:{列[0]}"
        assert 列[0]["推理强度"] == 取行("测 · 降级")["用力"] and 列[0]["模型"] == 取行("测 · 降级")["主用模型"]
        原强度 = 取行(末行)["用力"]
        c降.execute("UPDATE 功能 SET 用力='' WHERE 功能名=?", (末行,)); c降.commit()
        assert 族(末行, 库=降库)[-1]["推理强度"] == 关档, "强度空着该回关档"
        c降.execute("UPDATE 功能 SET 用力=? WHERE 功能名=?", (原强度, 末行)); c降.commit()
        c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,父功能) VALUES"
                   "('测 · 无头 · a','主家','m1','文本','测 · 无头'),('测 · 无头 · b','主家','m2','文本','测 · 无头')")
        c降.commit()
        assert [x["功能名"] for x in 族("测 · 无头 · b", 库=降库)] == ["测 · 无头 · a", "测 · 无头 · b"], \
            "没头行的族照兄弟行排"
        try:
            族("测 · 没这一行", 库=降库)
            raise AssertionError("功能表里没有的名字该报错")
        except 底座错误 as e:
            assert "功能表里没有" in str(e)

        c降.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,父功能) VALUES"
                   "('测史 · 甲','主家','m1','文本',NULL),('测史 · 甲 · 主家/m2','主家','m2','文本','测史 · 甲'),"
                   "('测史 · 乙','主家','m1','文本',NULL),('测史乙 · 丙','主家','m1','文本',NULL)")
        c降.executemany("INSERT INTO 日志(时刻,功能,用了谁,模型,成没成,耗时毫秒,报错原文) VALUES(?,?,?,?,?,?,?)", [
            ("2026-01-01 00:00:01", "测史 · 甲", "主家", "m1", 0, 5, "错" * 400),
            ("2026-01-01 00:00:02", "测史 · 甲 · 主家/m2", "主家", "m2", 1, 6, ""),
            ("2026-01-01 00:00:03", "测史 · 乙", "主家", "m1", 1, 7, ""),
            ("2026-01-01 00:00:04", "测史乙 · 丙", "主家", "m1", 1, 8, ""),
            ("2026-01-01 00:00:05", "测史 · 甲", "主家", "m1", None, 9, "")])
        c降.commit()
        读的键 = set(读配置(降库, 日志条数=1)["日志"][0])
        前功能 = [tuple(r) for r in c降.execute("SELECT * FROM 功能 ORDER BY 功能名")]
        前日志 = c降.execute("SELECT COUNT(*) FROM 日志").fetchone()[0]
        史 = 历史("测史 · 甲", 库=降库)
        assert [x["时刻"][-2:] for x in 史["日志"]] == ["05", "02", "01"], f"整族、新的在前:{史}"
        assert (史["调了"], 史["成了"]) == (3, 1), f"一行一次真发;成没成空着不算成:{史}"
        assert 史["日志"][0]["成没成"] is False and len(史["日志"][-1]["报错原文"]) == 300, "空算败、报错截 300"
        assert 历史("测史 · 甲 · 主家/m2", 库=降库) == 史, "给备选行也该回整族"
        assert set(史["日志"][0]) == 读的键, "每行的键得跟 读配置 那口一样"
        史 = 历史(软件="测史", 库=降库)
        assert [x["时刻"][-2:] for x in 史["日志"]] == ["05", "03", "02", "01"], f"「测史乙」不许混进来:{史}"
        assert (史["调了"], 史["成了"]) == (4, 2), f"按软件数:{史}"
        史 = 历史(软件="测史", 条数=1, 跳过=1, 库=降库)
        assert [x["时刻"][-2:] for x in 史["日志"]] == ["03"] and 史["调了"] == 4, f"条数只截行、不截计数:{史}"
        assert 历史(软件="没调过的软件", 库=降库) == {"日志": [], "调了": 0, "成了": 0}, "没调过回空,不报错"
        for 参 in ({}, {"功能名": "测史 · 甲", "软件": "测史"}, {"软件": "测史 · 甲"},
                  {"功能名": "测史 · 没这一行"}, {"软件": "测史", "条数": -1}):
            try:
                历史(**参, 库=降库)
                raise AssertionError(f"{参} 该被拦下")
            except 底座错误:
                pass
        assert [tuple(r) for r in c降.execute("SELECT * FROM 功能 ORDER BY 功能名")] == 前功能 and \
            c降.execute("SELECT COUNT(*) FROM 日志").fetchone()[0] == 前日志, "只读口一格都不许写"

        改库 = os.path.join(d, "改名.db")
        老 = sqlite3.connect(改库)
        老.execute("CREATE TABLE 功能 (功能名 TEXT PRIMARY KEY, 主用供应商 TEXT, 主用模型 TEXT)")
        老.execute("CREATE TABLE 日志 (时刻 TEXT, 功能 TEXT, 用了谁 TEXT, 模型 TEXT, 成没成 INTEGER,"
                 " 耗时毫秒 INTEGER, 报错原文 TEXT)")
        甲 = "测改 · 甲"
        老.executemany("INSERT INTO 功能 VALUES(?,?,?)", [
            (甲, "DeepSeek", "m0"),
            (甲 + " · DeepSeek/m1", "DeepSeek", "m2"),
            (甲 + " · DeepSeek/m2", "DeepSeek", "m1"),
            (甲 + " · DeepSeek/m9", "DeepSeek", "m3"),
            (甲 + " · 便宜快", "DeepSeek", "m4")])
        老.executemany("INSERT INTO 日志 VALUES(?,?,?,?,1,1,'')", [
            ("2026-01-01 00:00:01", 甲 + " · DeepSeek/m1", "DeepSeek", "m2"),
            ("2026-01-01 00:00:02", 甲 + " · DeepSeek/m2", "DeepSeek", "m1"),
            ("2026-01-01 00:00:03", 甲 + " · DeepSeek/m9", "DeepSeek", "m3"),
            ("2026-01-01 00:00:04", 甲 + " · 便宜快", "DeepSeek", "m4")])
        老.commit(); 老.close()
        c改 = 连库(改库)
        def 名对得上(c):
            for r in c.execute("SELECT * FROM 功能 WHERE 父功能<>''"):
                尾 = r["功能名"][len(r["父功能"]) + 3:] if r["功能名"].startswith(r["父功能"] + " · ") else ""
                if "/" in 尾:
                    assert 尾 == f"{r['主用供应商']}/{r['主用模型']}", f"名字跟设定对不上:{dict(r)}"
        assert c改.execute("SELECT COUNT(*) FROM 功能 WHERE 顺序 IS NULL").fetchone()[0] == 0, "老库升级该补满顺序"
        assert _族序(c改, 甲) == [甲, 甲 + " · DeepSeek/m2", 甲 + " · DeepSeek/m1", 甲 + " · DeepSeek/m3",
                                甲 + " · 便宜快"], f"升级只改名、位置一个不动:{_族序(c改, 甲)}"
        名对得上(c改)
        assert [r[0] for r in c改.execute("SELECT 功能 FROM 日志 ORDER BY 时刻")] == [
            甲 + " · DeepSeek/m1", 甲 + " · DeepSeek/m2", 甲 + " · DeepSeek/m3", 甲 + " · 便宜快"], \
            "只对调的两行日志不动;名字没了的(m9)日志改挂新名;手起的名不动"
        assert 历史(甲, 库=改库)["调了"] == 4, "改完名整族日志一条不丢"
        前号 = [r[0] for r in c改.execute(
            f"SELECT 顺序 FROM 功能 WHERE 父功能=? ORDER BY {_族内序}", (甲,))]
        c改.execute("UPDATE 功能 SET 主用模型='mX' WHERE 功能名=?", (甲 + " · DeepSeek/m3",))
        连库(改库).close()
        assert c改.execute("SELECT 1 FROM 功能 WHERE 功能名=?", (甲 + " · DeepSeek/m3",)).fetchone(), \
            "改名只在补列那一次跑,平时连库不许偷偷改名"
        c改.execute("UPDATE 功能 SET 主用模型='m3' WHERE 功能名=?", (甲 + " · DeepSeek/m3",))
        c改.close()
        出 = 挪一格(甲 + " · DeepSeek/m1", "上", 库=改库)
        c改 = 连库(改库)
        assert (出["这一行"], 出["换到"]) == (甲 + " · DeepSeek/m2", 甲 + " · DeepSeek/m1"), f"回的得是新名:{出}"
        assert _族序(c改, 甲)[1:3] == [甲 + " · DeepSeek/m1", 甲 + " · DeepSeek/m2"], "m1 挪到了第二位"
        名对得上(c改)
        assert [r[0] for r in c改.execute(
            f"SELECT 顺序 FROM 功能 WHERE 父功能=? ORDER BY {_族内序}", (甲,))] == 前号, "挪一格不许动顺序号"
        出 = 挪一格(甲 + " · DeepSeek/m1", "上", 库=改库)
        assert 出["换到"] == 甲 and 出["这一行"] == 甲 + " · DeepSeek/m0", f"{出}"
        assert c改.execute("SELECT 主用模型 FROM 功能 WHERE 功能名=?", (甲,)).fetchone()[0] == "m1"
        名对得上(c改)
        assert c改.execute("SELECT COUNT(*) FROM 日志 WHERE 功能=?", (甲 + " · DeepSeek/m1",)).fetchone()[0] == 0
        assert 历史(甲, 库=改库)["调了"] == 4, "跟头行对调后整族日志一条不丢"
        回 = {}
        assert 设路由(甲 + " · DeepSeek/m0", "DeepSeek", "m7", 库=改库, 回执=回)
        assert 回["全名"] == 甲 + " · DeepSeek/m7" and 回["改名"] == {甲 + " · DeepSeek/m0": 回["全名"]}, f"{回}"
        assert 设用力(回["全名"], "high", 库=改库), "面板拿回执里的新名接着存推理强度"
        回 = {}
        assert 设路由(甲 + " · 便宜快", "DeepSeek", "m8", 库=改库, 回执=回) and 回["全名"] == 甲 + " · 便宜快"
        回 = {}
        assert not 设路由("测改 · 没这一行", "DeepSeek", "m1", 库=改库, 回执=回) and 回["全名"] == ""
        设路由(甲 + " · DeepSeek/m7", "DeepSeek", "m2", 库=改库)
        assert 甲 + " · DeepSeek/m7" in _族序(c改, 甲), "撞了同设定的那一行先留原名、不报错"
        设路由(甲 + " · DeepSeek/m2", "DeepSeek", "m7", 库=改库)
        名对得上(c改)
        assert _族序(c改, 甲)[1:3] == [甲 + " · DeepSeek/m2", 甲 + " · DeepSeek/m7"], f"{_族序(c改, 甲)}"
        c改.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,父功能,顺序) VALUES"
                   "('测排 · 头','DeepSeek','h','文本','',1),"
                   "('测排 · 头 · DeepSeek/z','DeepSeek','q','文本','测排 · 头',2),"
                   "('测排 · 头 · DeepSeek/q','DeepSeek','q','文本','测排 · 头',3),"
                   "('测排 · 头 · DeepSeek/a','DeepSeek','a','文本','测排 · 头',4)")
        try:
            设路由("测排 · 头 · DeepSeek/q", "DeepSeek", "a", 库=改库)
            raise AssertionError("名字排不开该报错")
        except 底座错误 as e:
            assert "排不开" in str(e), str(e)
        assert c改.execute("SELECT 主用模型 FROM 功能 WHERE 功能名='测排 · 头 · DeepSeek/q'").fetchone()[0] == "q", \
            "报错了设定得退回去"
        c改.close()
        加功能("测序 · 头", "文本", "DeepSeek", "h", 库=改库)
        加备选("测序 · 头", "DeepSeek", "m9", 库=改库)
        加备选("测序 · 头", "DeepSeek", "m1", 库=改库)
        c改 = 连库(改库)
        期望 = ["测序 · 头", "测序 · 头 · DeepSeek/m9", "测序 · 头 · DeepSeek/m1"]
        assert _族序(c改, "测序 · 头") == 期望, f"新行排最后:{_族序(c改, '测序 · 头')}"
        头行 = c改.execute("SELECT * FROM 功能 WHERE 功能名='测序 · 头'").fetchone()
        assert [r["功能名"] for r in _降级候选(c改, 头行, "文本")] == 期望[1:]
        assert [x["功能名"] for x in 族("测序 · 头", 库=改库)] == 期望
        assert 列口("测序 · 头", 库=改库)["挑中"] == ["DeepSeek/m9", "DeepSeek/m1"]
        配 = 读配置(改库, 日志条数=0)["功能"]
        for 头 in {f["父功能"] or f["功能名"] for f in 配}:
            assert [f["功能名"] for f in 配 if (f["父功能"] or f["功能名"]) == 头] == _族序(c改, 头), \
                f"读配置 簇内先后得跟 _族序 一样:{头}"
        c改.close()

        def 只备二成(行, 供):
            if 行["功能名"] != "测 · 降级 · 备二":
                raise 造错(503)
            return "备二答的"
        c降.execute("UPDATE 功能 SET 启用=1")
        c降.commit()
        据: dict = {}
        assert _轮着试(c降, 主行, 主供, "文本", 只备二成, 回执=据) == "备二答的"
        assert 据["换过备选"] is True and 据["实际那一行"] == "测 · 降级 · 备二", f"回执:{据}"
        assert 据["功能名"] == "测 · 降级" and 据["试过"][0] == "测 · 降级", f"回执:{据}"
        assert 据["试过"][-1] == "测 · 降级 · 备二" and "503" in 据["首选错误"], f"回执:{据}"
        assert 据["模型"] == 取行("测 · 降级 · 备二")["主用模型"], "回执里的模型是实际那一行的"
        据 = {}
        assert _轮着试(c降, 主行, 主供, "文本", lambda 行, 供: "首选答的", 回执=据) == "首选答的"
        assert 据["换过备选"] is False and 据["首选错误"] == "" and 据["试过"] == ["测 · 降级"]
        跑过.clear()
        据 = {}
        try:
            _轮着试(c降, 主行, 主供, "文本",
                  lambda 行, 供: (跑过.append(行["功能名"]), 只备二成(行, 供))[1],
                  换备选=False, 回执=据)
            raise AssertionError("换备选=False 首选挂了该原样抛")
        except 底座错误 as e:
            assert "503" in str(e)
        assert 跑过 == ["测 · 降级"] and 据 == {}, f"只许打首选、失败不填回执:{跑过} {据}"
        for 口 in (问, 画图):
            参 = inspect.signature(口).parameters
            assert "回执" in 参 and 参["换备选"].default is True, f"{口.__name__} 该有 回执= 与 换备选=True"
        c降.close()

        assert 设项目笔记("示例", 备注="自动示例", 库=库)["备注"] == "自动示例"
        assert 设项目笔记("示例", 网址="http://127.0.0.1:8000/", 库=库)["备注"] == "自动示例", \
            "写网址不许把备注冲掉"
        assert 设项目笔记("示例", 备注="改了", 库=库)["网址"] == "http://127.0.0.1:8000/", \
            "写备注不许把网址冲掉"
        for 坏 in ("javascript:alert(1)", "file:///etc/passwd", "示例面板"):
            try:
                设项目笔记("示例", 网址=坏, 库=库)
                raise AssertionError(f"「{坏}」该被拦下 —— 这一格会变成页面上一个真能点的链接")
            except 底座错误:
                pass
        assert 读配置(库=库, 日志条数=0)["项目"]["示例"]["备注"] == "改了", \
            "面板要的那两格得跟着 读配置 一起出去"

        册 = 名册()
        assert 册, "出厂该带一份 厂商名册.json,读出来不该是空的"
        assert len({str(c["名"]).strip() for c in 册}) == len(册), "名册里名字不许重"
        for c in 册:
            assert not any(k in c for k in _名册禁格), \
                f"名册「{c['名']}」里带了密钥那一格 —— 这份文件是要发出去的"
            assert c["类型"] in _类型们 and str(c["地址"]).strip(), \
                f"名册「{c['名']}」的类型或地址不合格"
            assert (not c.get("注册页")) or str(c["注册页"]).startswith(("http://", "https://")), \
                f"名册「{c['名']}」的注册页得是 http/https"
        真名册, globals()["名册文件"] = 名册文件, os.path.join(d, "根本没有这个文件.json")
        try:
            assert 名册() == [], "名册文件不在时该回空清单,不该抛 —— 拨号一条路都不经过它"
        finally:
            globals()["名册文件"] = 真名册
        册库 = os.path.join(d, "名册.db")
        样 = 名册一家("智谱开放平台 · 生图")
        assert 样, "名册里该有「智谱开放平台 · 生图」"
        assert 加供应商("智谱开放平台 · 生图", 库=册库, 照名册=True) == "新建"
        行 = 连库(册库).execute(
            "SELECT * FROM 供应商 WHERE 名='智谱开放平台 · 生图'").fetchone()
        assert 行["地址"] == 样["地址"] and 行["模型们"] == 样["模型们"], "网址和模型清单该照抄"
        assert 行["注册页"] == 样["注册页"], "去哪领 key 那一格也得抄进来"
        assert "领key步骤" not in 行.keys(), "领 key 步骤是指南,不许在库里再存一份"
        册家 = {s["名"]: s for s in 读配置(库=册库, 日志条数=0)["供应商"]}["智谱开放平台 · 生图"]
        assert 册家["领key步骤"] == list(样.get("领key步骤") or []), "领 key 步骤该跟着读配置出去"
        assert bool(行["免费"]) and not 行["吃订阅"], "免费 / 吃订阅 两个标记该照名册来"
        assert not 行["密钥"], "照名册加出来的这家,密钥必须还是空的"
        try:
            加供应商("查无此家", 库=册库, 照名册=True)
            raise AssertionError("名册里没有的名字该被拦下")
        except 底座错误:
            pass
        设限速("智谱开放平台 · 生图", 9, 99, 库=册库)
        设免费("智谱开放平台 · 生图", False, 库=册库)
        加供应商("智谱开放平台 · 生图", 库=册库, 照名册=True)
        行2 = 连库(册库).execute(
            "SELECT 最小间隔秒,每小时上限,免费 FROM 供应商 WHERE 名='智谱开放平台 · 生图'").fetchone()
        assert (行2["最小间隔秒"], 行2["每小时上限"]) == (9.0, 99), \
            "改一家已有的不许把人手调过的节流冲回模板值"
        assert not 行2["免费"], "手点掉的「免费」标记也不许被模板盖回来"
        assert 设注册页("智谱开放平台 · 生图", "https://例子.test/key", 库=册库)
        assert 设只收前缀("智谱开放平台 · 生图", "glm", 库=册库)
        assert 设强度档("智谱开放平台 · 生图", "low,high", 库=册库)
        行3 = 连库(册库).execute(
            "SELECT 注册页,只收前缀,强度档 FROM 供应商 WHERE 名='智谱开放平台 · 生图'").fetchone()
        assert 行3["注册页"] == "https://例子.test/key"
        assert 行3["只收前缀"] == "glm" and 行3["强度档"] == "low,high"
        for 坏 in ("javascript:alert(1)", "file:///etc/passwd", "opencode.ai"):
            try:
                设注册页("智谱开放平台 · 生图", 坏, 库=册库)
                raise AssertionError(f"注册页「{坏}」该被拦下")
            except 底座错误:
                pass
        assert 设注册页("智谱开放平台 · 生图", "", 库=册库)
        assert any(x["名"] == "智谱开放平台 · 生图" and x["注册页"] == ""
                   for x in 读配置(库=册库, 日志条数=0)["供应商"]), \
            "注册页得跟着 读配置 一起出去(面板第二步那行链接吃它),抹空之后是空串"

        assert 设到期日("DeepSeek", "2026-10-01", 库=册库)
        for 坏 in ("10月1日", "2026-13-01", "2026/10/01"):
            try:
                设到期日("DeepSeek", 坏, 库=册库)
                raise AssertionError(f"到期日「{坏}」该被拦下 —— 面板拿它算还剩几天")
            except 底座错误:
                pass
        家们 = {x["名"]: x for x in 读配置(库=册库, 日志条数=0)["供应商"]}
        assert 家们["DeepSeek"]["到期日"] == "2026-10-01", "到期日得跟着 读配置 出去"
        assert 家们["DeepSeek"]["查得了余额"] and not 家们["Groq"]["查得了余额"], \
            "查不查得了余额只看名册那家有没有「余额接口」"
        assert 家们["Groq"]["用量页"].startswith("https://"), "Groq 该带着官网看限额那一页"
        assert 家们["DeepSeek"]["余额"] == "" and 家们["DeepSeek"]["余额于"] == "", "没拿到过就是空,不许编"
        assert 设到期日("DeepSeek", "", 库=册库)
        assert next(x for x in 读配置(库=册库, 日志条数=0)["供应商"] if x["名"] == "DeepSeek")["到期日"] == ""
        try:
            查余额("DeepSeek", 库=册库)
            raise AssertionError("没填 key 该当场拦下,不许发出去")
        except 底座错误 as e:
            assert "密钥" in str(e), str(e)
        try:
            查余额("Groq", 库=册库)
            raise AssertionError("Groq 没有余额接口,该当场说清去哪看")
        except 底座错误 as e:
            assert "console.groq.com" in str(e), f"报错里得带上官网看用量那一页:{e}"

        class _余额回:
            def __init__(self, 文, 头=None): self.文, self.headers = 文.encode(), (头 or {})
            def read(self): return self.文
            def __enter__(self): return self
            def __exit__(self, *a): return False
        发过, 原开 = [], urllib.request.urlopen
        设密钥("DeepSeek", "sk-yue", 库=册库)
        try:
            urllib.request.urlopen = lambda 请, **k: (发过.append(请), _余额回(
                '{"is_available":true,"balance_infos":[{"currency":"CNY","total_balance":"110.00",'
                '"granted_balance":"10.00","topped_up_balance":"100.00"}]}'))[1]
            r = 查余额("DeepSeek", 库=册库)
            assert r["余额"] == "余额 CNY 110.00(其中赠送 10.00)", r
            assert 发过[0].get_method() == "GET" and 发过[0].full_url == "https://api.deepseek.com/user/balance"
            assert 发过[0].get_header("Authorization") == "Bearer sk-yue", "查余额得带上 key"
            urllib.request.urlopen = lambda 请, **k: _余额回(
                '{"is_available":false,"balance_infos":[{"currency":"CNY","total_balance":"0.00",'
                '"granted_balance":"0.00","topped_up_balance":"0.00"}]}')
            assert 查余额("DeepSeek", 库=册库)["余额"] == "⚠ 余额不够调用 · 余额 CNY 0.00"
            urllib.request.urlopen = lambda 请, **k: _余额回('{"意外":1}')
            try:
                查余额("DeepSeek", 库=册库)
                raise AssertionError("认不出的回包该报错,不许拿半截当余额")
            except 底座错误:
                pass
            家 = next(x for x in 读配置(库=册库, 日志条数=0)["供应商"] if x["名"] == "DeepSeek")
            assert 家["余额"] == "⚠ 余额不够调用 · 余额 CNY 0.00" and 家["余额于"], \
                "认不出的那次不许盖掉上一次拿到的余额"
            设密钥("Groq", "gsk-yue", 库=册库)
            设限速("Groq", 0, 0, 库=册库)
            加功能("测 · 余额头", "文本", "Groq", "m余", 库=册库)
            urllib.request.urlopen = lambda 请, **k: _余额回(
                '{"choices":[{"message":{"content":"好"}}]}',
                {"x-ratelimit-remaining-requests": "998", "x-ratelimit-limit-requests": "1000"})
            assert 问("测 · 余额头", system="s", user="u", 库=册库) == "好"
            家 = next(x for x in 读配置(库=册库, 日志条数=0)["供应商"] if x["名"] == "Groq")
            assert 家["余额"] == "m余 今天还剩 998/1000 次", 家["余额"]
            urllib.request.urlopen = lambda 请, **k: _余额回('{"choices":[{"message":{"content":"好"}}]}')
            assert 问("测 · 余额头", system="s", user="u", 库=册库) == "好"
            assert next(x for x in 读配置(库=册库, 日志条数=0)["供应商"]
                        if x["名"] == "Groq")["余额"] == "m余 今天还剩 998/1000 次", "不报的那次不许抹成空或 0"
        finally:
            urllib.request.urlopen = 原开
        assert _剩余次数({"x-ratelimit-remaining-requests": "abc"}) is None, "不是数就当不知道"

    assert 拼地址("https://api.deepseek.com") == "https://api.deepseek.com/chat/completions"
    assert 拼地址("https://api.deepseek.com/") == "https://api.deepseek.com/chat/completions", \
        "末尾那个斜杠不该拼出两道杠"
    assert 拼地址("  https://api.deepseek.com  ") == "https://api.deepseek.com/chat/completions", \
        "粘进来的前后空格得先剥掉"
    for 全 in ("https://api.deepseek.com/chat/completions",
               "https://open.bigmodel.cn/api/paas/v4/images/generations",
               "http://127.0.0.1:8317/v1/chat/completions",
               "http://127.0.0.1:8317/v1beta/models/gemini-3.5-flash:generateContent"):
        assert 拼地址(全) == 全, f"「{全}」已经是全的,不许再动它"
        assert 拼地址(拼地址(全)) == 拼地址(全), f"「{全}」拼两遍得跟拼一遍一样"
    assert 拼地址("https://open.bigmodel.cn/api/paas/v4/images/generations") \
        .endswith("/images/generations"), "生图那条尾巴不许被换掉"
    assert 拼地址("") == "" and 拼地址(None) == "", "空的回空,面板那行灰字靠它判要不要显示"
    assert 拼地址("https://open.bigmodel.cn/api/paas/v4", "/images/generations") \
        == "https://open.bigmodel.cn/api/paas/v4/images/generations"
    assert 拼地址("https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run") \
        == "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run", \
        "Cloudflare /ai/run 已经是完整地址,不许再接 /chat/completions"
    try:
        _要密钥({"名": "Cloudflare Workers AI", "地址":
                "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
                "密钥": "假密钥"})
        raise AssertionError("Cloudflare 地址里的 account_id 还没填时该当场报错")
    except 底座错误 as e:
        assert "地址里的账户 ID 还没填" in str(e), f"账户 ID 占位报错不对:{e}"
        assert not _换得了吗(e), "账户 ID 没填跟密钥没填同类,不许自动换备选"
    for 条 in 名册():
        if 条["类型"] == "网页接口":
            assert 拼地址(条["地址"]) == 条["地址"], \
                f"名册「{条['名']}」的地址过一遍 拼地址 变了样:{条['地址']} → {拼地址(条['地址'])}"

    assert _新版模型("gpt-8-sol", ["gpt-8.10-sol", "gpt-9-luna"]) == "gpt-8.10-sol"
    assert _新版模型("gpt-8-sol", ["gpt-9-astra", "gpt-8.1-sol-preview"]) is None
    assert _新版模型("claude-opus-8-20260101", ["claude-opus-8-2"]) == "claude-opus-8-2"
    with tempfile.TemporaryDirectory() as d新:
        库新 = os.path.join(d新, "updates.db")
        加供应商("测试换新", "网页接口", "https://example.invalid/v1/chat/completions",
              "gpt-8-sol,gpt-8.1-sol", 库=库新)
        设密钥("测试换新", "fixture", 库=库新)
        加功能("测试 · 换新", "文本", "测试换新", "gpt-8-sol", 库=库新)
        c新 = 连库(库新)
        _记一格(c新, "测试换新", "gpt-8.1-sol", 强度档="low,high", 档位来源="接口自报",
              档位指纹=_通道指纹("网页接口", "https://example.invalid/v1/chat/completions", "gpt-8.1-sol"))
        前新 = _更新快照(c新)["功能"]
        c新.close()
        p新 = 模型更新预览(库新)
        assert p新["上次检查"] == "", "没拉过清单时上次检查得是空"
        c新 = 连库(库新)
        c新.execute("UPDATE 供应商 SET 清单于='2026-10-04 06:00:00' WHERE 名='测试换新'")
        c新.close()
        p时 = 模型更新预览(库新)
        assert p时["上次检查"] == "2026-10-04 06:00:00", f"上次检查该读清单于:{p时['上次检查']}"
        assert p时["指纹"] == p新["指纹"], "清单于不许进预览指纹(巡检一跑就作废别人手里的预览)"
        r新 = 应用模型更新(p新["指纹"], [{"功能名": r["功能名"], "新模型": r["新模型"]} for r in p新["更新"]], 库=库新)
        assert r新["数量"] == 1, "批量换新该改一个临时功能"
        撤回模型更新(r新["撤回"], 库=库新)
        c新 = 连库(库新)
        assert _更新快照(c新)["功能"] == 前新, "撤回应恢复整族配置"
        c新.close()
    with tempfile.TemporaryDirectory() as d连:
        库连 = os.path.join(d连, "c.db")
        设密钥("DeepSeek", "sk-zijian", 库=库连)
        原开 = urllib.request.urlopen
        def 拒连(*a, **k):
            raise urllib.error.URLError(ConnectionRefusedError(111, "Connection refused"))
        def 回401(*a, **k):
            raise urllib.error.HTTPError("http://x", 401, "Unauthorized", {}, None)
        try:
            for 假, 该类 in ((拒连, 连不上), (回401, 底座错误)):
                urllib.request.urlopen = 假
                try:
                    问("示例 · 生成", "s", "u", 库=库连)
                    raise AssertionError("该报错却没报")
                except 底座错误 as e:
                    assert type(e) is 该类, f"{假.__name__} 该报 {该类.__name__},实得 {type(e).__name__}"
        finally:
            urllib.request.urlopen = 原开
        加供应商("测 · 没装的命令行", "命令行", "ai-base-zijian-no-such-cli", "m", 库=库连)
        设同意("测 · 没装的命令行", True, 库=库连)
        加功能("测 · 没装活", "文本", "测 · 没装的命令行", "m", 库=库连)
        try:
            问("测 · 没装活", "s", "u", 重试=0, 换备选=False, 库=库连)
            raise AssertionError("没装的命令行该报错")
        except 底座错误 as e:
            assert type(e) is 缺配置, f"找不到程序该报 缺配置,实得 {type(e).__name__}: {e}"
    with tempfile.TemporaryDirectory() as d密:
        密库 = os.path.join(d密, "m.db")
        c = 连库(密库)
        取家 = lambda 名: c.execute("SELECT * FROM 供应商 WHERE 名=?", (名,)).fetchone()
        assert 是Anthropic(取家(_测CL)) and not 是Anthropic(取家("DeepSeek")), "只有命令行 claude 算"
        假 = lambda 类型, 地址: {"类型": 类型, "地址": 地址}
        assert 是Anthropic(假("命令行", r"C:\bin\claude.cmd")) and 是Anthropic(假("命令行", "/usr/bin/claude -x"))
        assert not 是Anthropic(假("命令行", "codex")) and not 是Anthropic(假("网页接口", "http://x/claude"))
        assert not 是Anthropic(None)
        设同意(_测CL, True, 库=密库)
        加功能("测 · 密", "文本", _测CL, "sonnet", 库=密库)
        加功能("测 · 平", "文本", "DeepSeek", "x", 库=密库)
        assert 设机密("测 · 密", True, 库=密库) and not 设机密("测 · 密", True, 库=密库)
        def 该拒(做, 话):
            try:
                做()
            except 机密拒拨 as e:
                assert "只许用 Claude" in str(e), e
                return
            raise AssertionError(f"{话} 该被 机密拒拨 拦下")
        该拒(lambda: 设路由("测 · 密", "DeepSeek", "x", 库=密库), "设路由拨 DeepSeek")
        该拒(lambda: 加备选("测 · 密", "DeepSeek", "x", 库=密库), "加备选挂 DeepSeek")
        该拒(lambda: 设档("测 · 密", ["DeepSeek/x"], 库=密库), "设档挑 DeepSeek")
        该拒(lambda: 加功能("测 · 密", "文本", "DeepSeek", "x", 库=密库), "加功能改头行到 DeepSeek")
        该拒(lambda: 加功能("测 · 密 · 子", "文本", "DeepSeek", "x", 库=密库), "加功能挂子行到 DeepSeek")
        assert c.execute("SELECT 主用供应商 FROM 功能 WHERE 功能名='测 · 密'").fetchone()[0] == _测CL
        备名 = 加备选("测 · 密", _测CL, "haiku", 库=密库)
        assert 设路由("测 · 平", "DeepSeek", "y", 库=密库), "没标的照旧随便拨"
        try:
            设机密(备名, True, 库=密库)
            raise AssertionError("标只许打在头行")
        except 机密拒拨:
            raise AssertionError("打在备选行该报普通错,不是拒拨")
        except 底座错误:
            pass
        c.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,种类,父功能,顺序) "
                  "VALUES('测 · 密 · 偷','DeepSeek','x','文本','测 · 密',99)")
        违 = 机密违规(库=密库)
        assert [v["功能名"] for v in 违] == ["测 · 密 · 偷"], 违
        配 = 读配置(库=密库)
        assert 配["机密违规"] == 违 and all(f["客户机密"] for f in 配["功能"] if f["功能名"].startswith("测 · 密"))
        assert not next(f for f in 配["功能"] if f["功能名"] == "测 · 平")["客户机密"]
        该拒(lambda: 对调设定("测 · 密", "测 · 密 · 偷", 库=密库), "把违规行对调成首选")
        def 造错(码):
            e = 底座错误(f"HTTPError: {码}")
            e.原因 = urllib.error.HTTPError("u", 码, "x", {}, None)
            return e
        主行 = c.execute("SELECT * FROM 功能 WHERE 功能名='测 · 密'").fetchone()
        跑过 = []
        def 都429(行, 供):
            跑过.append(行["功能名"])
            raise 造错(429)
        try:
            _轮着试(c, 主行, 取家(_测CL), "文本", 都429)
            raise AssertionError("全挂该抛")
        except 机密拒拨:
            raise AssertionError("有 Claude 候选时该报它自己的 429,不是拒拨")
        except 底座错误 as e:
            assert "429" in str(e)
        assert "测 · 密 · 偷" not in 跑过 and 跑过[0] == "测 · 密", f"DeepSeek 那行一次都不许跑:{跑过}"
        c.execute("UPDATE 功能 SET 主用供应商='DeepSeek' WHERE 功能名='测 · 密'")
        主行 = c.execute("SELECT * FROM 功能 WHERE 功能名='测 · 密'").fetchone()
        跑过.clear()
        assert _轮着试(c, 主行, 取家("DeepSeek"), "文本",
                     lambda 行, 供: (跑过.append(行["功能名"]), 供["名"])[1]) == _测CL
        assert 跑过 == [备名], 跑过
        c.execute("DELETE FROM 功能 WHERE 功能名=?", (备名,))
        跑过.clear()
        该拒(lambda: _轮着试(c, 主行, 取家("DeepSeek"), "文本", lambda 行, 供: 跑过.append(1)), "整族没 Claude")
        assert 跑过 == []
        该拒(lambda: 问("测 · 密", "s", "u", 重试=0, 库=密库), "问() 走带标那族")
        该拒(lambda: 问("测 · 密 · 偷", "s", "u", 重试=0, 库=密库), "直接报备选行名也跟头行的标")
        该拒(lambda: 问("测 · 平", "s", "u", 重试=0, 客户机密=True, 库=密库), "自报敏感内容")
        平行 = c.execute("SELECT * FROM 功能 WHERE 功能名='测 · 平'").fetchone()
        assert _轮着试(c, 平行, 取家("DeepSeek"), "文本", lambda 行, 供: "平的答") == "平的答"
        assert 设机密("测 · 密", False, 库=密库)
        assert "去掉了敏感内容标" in c.execute("SELECT 说明 FROM 功能 WHERE 功能名='测 · 密'").fetchone()[0]
        assert 机密违规(库=密库) == []
        c.close()
    with tempfile.TemporaryDirectory() as d并:
        并库 = os.path.join(d并, "b.db")
        加功能("测 · 并", "文本", "DeepSeek", "x", 库=并库)
        并备 = 加备选("测 · 并", "DeepSeek", "y", 库=并库)
        assert 同时几个("测 · 并", 库=并库) is None and 同时几个(并备, 库=并库) is None, "新行没设回 None"
        assert 设同时(并备, "3", 库=并库) and not 设同时("测 · 并", 3, 库=并库), "写备选名落头行,同值不算改"
        assert 同时几个("测 · 并", 库=并库) == 3 == 同时几个(并备, 库=并库)
        c = 连库(并库)
        assert c.execute("SELECT 同时 FROM 功能 WHERE 功能名=?", (并备,)).fetchone()[0] is None, "备选行那格不写"
        c.close()
        assert {f["功能名"]: f["同时"] for f in 读配置(库=并库)["功能"]
                if f["功能名"].startswith("测 · 并")} == {"测 · 并": 3, 并备: 3}
        for 坏 in ("0", "65", "三", 1.5):
            try:
                设同时("测 · 并", 坏, 库=并库)
                raise AssertionError(f"{坏!r} 该被拒")
            except 底座错误 as e:
                assert "同时跑几个" in str(e), e
        try:
            同时几个("测 · 没这行", 库=并库)
            raise AssertionError("没登记的名字该抛")
        except 功能未登记:
            pass
        assert 设同时("测 · 并", "", 库=并库) and 同时几个("测 · 并", 库=并库) is None, "空 = 抹掉"
    with tempfile.TemporaryDirectory() as d号:
        号库 = os.path.join(d号, "h.db")
        配 = 读配置(库=号库)
        for 键, 前 in (("供应商", "GS"), ("功能", "GN")):
            号们 = [x["ID"] for x in 配[键]]
            assert 号们 and all(re.fullmatch(前 + r"\d{4,}", h) for h in 号们), f"出厂{键}行该都有 {前} 号:{号们}"
            assert len(set(号们)) == len(号们), f"{键}号重了:{号们}"
        assert _编号("GN", 7) == "GN0007" and _编号("RZ", 12345) == "RZ12345" and _编号("GS", None) == ""
        加功能("测 · 号", "文本", "DeepSeek", "x", 库=号库)
        c = 连库(号库)
        号 = lambda 名: c.execute("SELECT 号 FROM 功能 WHERE 功能名=?", (名,)).fetchone()[0]
        甲 = 号("测 · 号")
        assert 甲 == c.execute("SELECT MAX(号) FROM 功能").fetchone()[0], "新行接在最大号后面"
        c.execute("UPDATE 功能 SET 功能名='测 · 号改' WHERE 功能名='测 · 号'")
        assert 号("测 · 号改") == 甲, "改名不许换号"
        c.close()
        assert 删功能("测 · 号改", 库=号库)
        加功能("测 · 号", "文本", "DeepSeek", "x", 库=号库)
        c = 连库(号库)
        assert 号("测 · 号") == 甲 + 1, f"删掉的号不许回收:原 {甲},新 {号('测 · 号')}"
        _记日志(c, "测 · 号", "DeepSeek", "x", True, time.time(), "")
        _记日志(c, "测 · 号", "DeepSeek", "x", False, time.time(), "错")
        c.close()
        志 = 读配置(库=号库)["日志"]
        assert [x["ID"] for x in 志[:2]] == ["RZ0002", "RZ0001"], [x["ID"] for x in 志[:2]]
        assert [x["ID"] for x in 历史("测 · 号", 库=号库)["日志"]] == ["RZ0002", "RZ0001"]
        老号库 = os.path.join(d号, "old.db")
        老 = sqlite3.connect(老号库)
        老.execute("CREATE TABLE 日志 (时刻 TEXT, 功能 TEXT, 用了谁 TEXT, 模型 TEXT, 成没成 INTEGER,"
                 " 耗时毫秒 INTEGER, 报错原文 TEXT)")
        老.executemany("INSERT INTO 日志 VALUES(?,?,?,?,1,1,'')",
                      [("2026-10-01 0%d:00:00" % i, "老 · 功", "家", "m") for i in range(3)])
        老.commit()
        老.close()
        c = 连库(老号库)
        头回 = [tuple(r) for r in c.execute("SELECT rowid, 号 FROM 日志 ORDER BY rowid")]
        assert 头回 == [(1, 1), (2, 2), (3, 3)], f"老日志按先后补号:{头回}"
        功号 = [r[0] for r in c.execute("SELECT 号 FROM 功能 ORDER BY rowid")]
        assert 功号 == sorted(功号) and None not in 功号, f"出厂功能行也该有号:{功号}"
        c.close()
        c = 连库(老号库)
        assert [tuple(r) for r in c.execute("SELECT rowid, 号 FROM 日志 ORDER BY rowid")] == 头回, "补号只补一次"
        _记日志(c, "老 · 功", "家", "m", True, time.time(), "")
        assert c.execute("SELECT MAX(号) FROM 日志").fetchone()[0] == 4, "补完以后新行接 4"
        try:
            c.execute("UPDATE 日志 SET 号=1 WHERE 号=2")
            raise AssertionError("同号该被唯一索引拦住")
        except sqlite3.IntegrityError:
            pass
        c.close()
    print("自检全过")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    动作 = argv[1]
    if 动作 == "看":
        _看()
    elif 动作 == "自检":
        _自检()
    elif 动作 == "限速":
        if len(argv) != 5:
            print('用法:python3 ai.py 限速 "<供应商名>" <最少隔几秒> <每小时最多几次>   (都写 0 = 不限)')
            return 1
        try:
            改 = 设限速(argv[2], float(argv[3]), int(argv[4]))
        except ValueError:
            print("后两个要填数字,比如:限速 \"CPA 反代\" 3 60")
            return 1
        念 = lambda v, 有, 没: (没 if float(v) == 0 else 有.format(v))
        print(f"「{argv[2]}」:{念(argv[3], '两次调用至少隔 {} 秒', '两次调用不用等')}、"
              f"{念(argv[4], '一小时最多 {} 次', '一小时调多少次都行')}"
              if 改 else f"供应商表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "藏":
        if len(argv) < 4:
            print('用法:python3 ai.py 藏 "<供应商名>" <模型> [为什么]')
            return 1
        新记 = 藏(argv[2], argv[3], argv[4] if len(argv) > 4 else "")
        print(f"「{argv[2]} / {argv[3]}」{'记下了' if 新记 else '本来就藏着,理由更新了'} —— "
              f"往后拉模型清单不会再把它拉进来。想放回:python3 ai.py 放回 \"{argv[2]}\" {argv[3]}")
        return 0
    elif 动作 == "放回":
        if len(argv) != 4:
            print('用法:python3 ai.py 放回 "<供应商名>" <模型>')
            return 1
        改 = 放回(argv[2], argv[3])
        print(f"「{argv[2]} / {argv[3]}」放回来了 —— 下次拉清单它就能再露面"
              if 改 else f"本来就没藏着「{argv[2]} / {argv[3]}」")
        return 0 if 改 else 1
    elif 动作 == "藏着的":
        行 = 藏着的(argv[2] if len(argv) > 2 else "")
        if not 行:
            print("一个都没藏")
            return 0
        print(f"藏着 {len(行)} 个(拉模型清单时不会露面;它们只是不显示,不挡已经拨给它们的调用):")
        for r in 行:
            print(f"  {r['供应商']:22s} {r['模型']:38s} {r['何时']}  {r['为什么'] or ''}")
        return 0
    elif 动作 in ("开启", "关闭"):
        if len(argv) != 3:
            print(f'用法:python3 ai.py {动作} <供应商名>' +
                  ('   (写「全部」= 把标了吃订阅的全开了)' if 动作 == "开启" else ""))
            return 1
        if 动作 == "开启" and argv[2] in ("全部", "全"):
            几 = 开启全部()
            print(f"开了 {几} 家" if 几 else "没有需要开的:标了吃订阅的那几家已经全开着了")
            return 0
        改 = 设同意(argv[2], 动作 == "开启")
        if not 改:
            print(f"供应商表里没有「{argv[2]}」")
            return 1
        print(f"「{argv[2]}」开了,现在拨得动了。烧的是你自己账号的订阅额度,悠着点用。"
              if 动作 == "开启" else f"「{argv[2]}」关了,再拨它会被拦下。")
    elif 动作 == "出口":
        r = 查出口()
        if not r["现在"]:
            print(f"探不到出口 IP({r['错']})。网络不通或者两个探针都被挡了。")
            return 1
        print(f"这台机器现在从这个 IP 出去:{r['现在']}")
        if r["地"]:
            print(f"这个 IP 落在:{r['地']}" + (f"({r['运营商']})" if r["运营商"] else ""))
        if r["变了"]:
            print(f"⚠ 跟上一次记的不一样(上次是 {r['上次']})。")
        print("\n请你自己核对一件事:拿浏览器打开 https://api.ipify.org ,")
        print("看到的 IP 跟上面这个**一样**才算稳妥 —— 那说明这个软件和你平时登录账号的")
        print("网络是同一条路。两边对不上,等于同一个账号一边在家、一边在机房,容易被判异常。")
        print("\n这条路本身就有账号被限制的风险,自己权衡后再用。")
        if r["历史"]:
            print("\n记过的出口:")
            for h in r["历史"]:
                print(f"  {h['时刻']}  {h['地址']}")
    elif 动作 == "设密钥":
        if len(argv) != 4:
            print("用法:python3 ai.py 设密钥 <供应商名> <key>")
            return 1
        改 = 设密钥(argv[2], argv[3])
        print(f"已存 {argv[2]} 的密钥" if 改 else f"供应商表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "设供应商":
        if len(argv) not in (4, 5):
            print('用法:python3 ai.py 设供应商 "<功能名>" <供应商名> [模型]')
            return 1
        try:
            改 = 设路由(argv[2], argv[3], argv[4] if len(argv) == 5 else None)
        except 底座错误 as e:
            print(e)
            return 1
        print(f"「{argv[2]}」改用 {argv[3]}" if 改 else f"功能表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "名册":
        册 = 名册()
        if not 册:
            print(f"名册是空的(文件:{名册文件})")
            return 0
        库有 = {r["名"] for r in 连库().execute("SELECT 名 FROM 供应商")}
        print(f"出厂名册里有 {len(册)} 家(打 ✓ 的库里已经有了):")
        for 条 in 册:
            打 = "✓" if 条["名"] in 库有 else " "
            标 = ("免费 " if 条.get("免费") else "") + ("吃订阅 " if 条.get("吃订阅") else "")
            print(f"  {打} {条['名']:22s} {条['类型']:6s} {条['地址']}")
            if 标 or 条.get("注册页"):
                print(f"      {标}{('领 key:' + 条['注册页']) if 条.get('注册页') else ''}")
        print("加一家:python3 ai.py 照名册加 \"<上面那个名字>\"   加完再 设密钥")
        return 0
    elif 动作 == "照名册加":
        if len(argv) != 3:
            print('用法:python3 ai.py 照名册加 "<名册里的名字>"   (看有谁:python3 ai.py 名册)')
            return 1
        try:
            怎么了 = 加供应商(argv[2], 照名册=True)
        except 底座错误 as e:
            print(e)
            return 1
        条 = 名册一家(argv[2]) or {}
        print(f"「{argv[2]}」" + ("照名册加好了" if 怎么了 == "新建" else
                                "本来就有 —— 只按名册改了网址和模型清单,"
                                "节流、免费、只收前缀那几格没动(人手调过的不冲掉)"))
        print(f"  下一步:python3 ai.py 设密钥 \"{argv[2]}\" <key>" +
              (f"    去这里领:{条['注册页']}" if 条.get("注册页") else ""))
        return 0
    elif 动作 == "注册页":
        if len(argv) != 4:
            print('用法:python3 ai.py 注册页 <供应商名> <网址>   (写「空」= 抹掉这一格)')
            return 1
        值 = "" if argv[3] in ("空", "无") else argv[3]
        try:
            改 = 设注册页(argv[2], 值)
        except 底座错误 as e:
            print(e)
            return 1
        print((f"「{argv[2]}」领 key 的地方记成 {值}" if 值 else f"「{argv[2]}」的注册页抹掉了")
              if 改 else f"供应商表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "只收前缀":
        if len(argv) != 4:
            print('用法:python3 ai.py 只收前缀 <供应商名> <前缀,逗号隔开>   (写「空」= 全收)')
            return 1
        值 = "" if argv[3] in ("空", "无") else argv[3]
        改 = 设只收前缀(argv[2], 值)
        print((f"「{argv[2]}」往后拉模型列表只收名字以 {值} 开头的"
               if 值 else f"「{argv[2]}」往后拉模型列表全收")
              if 改 else f"供应商表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "免费":
        if len(argv) != 4 or argv[3] not in ("是", "否"):
            print('用法:python3 ai.py 免费 <供应商名> <是|否>')
            return 1
        改 = 设免费(argv[2], argv[3] == "是")
        print((f"「{argv[2]}」标成免费了 —— 它只是个标签,不挡调用,"
               f"但面板的引导第 1 件不会把它算成办完了"
               if argv[3] == "是" else f"「{argv[2]}」的免费标记去掉了")
              if 改 else f"供应商表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "强度档":
        if len(argv) != 4:
            print('用法:python3 ai.py 强度档 <供应商名> <档,逗号隔开,从低到高>   (写「空」= 回默认)')
            return 1
        值 = "" if argv[3] in ("空", "无") else argv[3]
        改 = 设强度档(argv[2], 值)
        print((f"「{argv[2]}」自己认的推理强度记成 {值}(约定从低到高)"
               if 值 else f"「{argv[2]}」的强度档抹掉了,回到按类型取默认")
              if 改 else f"供应商表里没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "加供应商":
        if len(argv) not in (5, 6):
            print('用法:python3 ai.py 加供应商 <名> <网页接口|命令行> <网址或命令> [模型清单,逗号隔开]')
            return 1
        try:
            怎么了 = 加供应商(argv[2], argv[3], argv[4], argv[5] if len(argv) == 6 else "")
        except 底座错误 as e:
            print(e)
            return 1
        print(f"「{argv[2]}」" + ("加好了" if 怎么了 == "新建" else "本来就有,改的是它"))
    elif 动作 == "机密":
        if len(argv) != 4 or argv[3] not in ("是", "否"):
            print('用法:python3 ai.py 机密 "<功能名>" <是|否>')
            return 1
        try:
            改了 = 设机密(argv[2], argv[3] == "是")
        except 底座错误 as e:
            print(e)
            return 1
        print(f"「{argv[2]}」" + (("打上了敏感内容标" if argv[3] == "是" else "去掉了敏感内容标(说明里留了一笔)")
                               if 改了 else "本来就是这样,没改"))
        for v in 机密违规():
            print(f"  ⚠ 违规:「{v['族']}」底下「{v['功能名']}」拨的是 {v['供应商']}/{v['模型']}")
    elif 动作 == "同时":
        if len(argv) not in (3, 4):
            print('用法:python3 ai.py 同时 "<功能名>" [几个|空]')
            return 1
        try:
            if len(argv) == 4:
                设同时(argv[2], None if argv[3] == "空" else argv[3])
            数 = 同时几个(argv[2])
        except 底座错误 as e:
            print(e)
            return 1
        print(f"「{argv[2]}」同时跑几个:" + (str(数) if 数 is not None else "没设(接入方用自己的老数)"))
    elif 动作 == "加功能":
        if len(argv) not in (5, 6):
            print('用法:python3 ai.py 加功能 "<功能名>" <文本|生图> <供应商名> [模型]')
            return 1
        try:
            怎么了 = 加功能(argv[2], argv[3], argv[4], argv[5] if len(argv) == 6 else "")
        except 底座错误 as e:
            print(e)
            return 1
        print(f"「{argv[2]}」" + ("挂上去了" if 怎么了 == "新建" else "本来就有,改的是它"))
    elif 动作 == "问模型":
        if len(argv) != 3:
            print("用法:python3 ai.py 问模型 <供应商名>   (问它要模型列表,回来的覆盖进「模型们」)")
            return 1
        try:
            r = 问模型清单(argv[2])
        except 底座错误 as e:
            print(e, file=sys.stderr)
            return 1
        print(f"问的是 {r['地址']},拿回 {len(r['清单'])} 个:")
        print("  " + ", ".join(r["清单"]))
        走了 = r["不认了"]
        if 走了:
            print(f"⚠ 原来清单里这几个它现在不认了:{', '.join(走了)}"
                  "。功能表里还拨给它们的那几行会调不动,去面板上改一下。")
    elif 动作 == "巡检":
        r = 巡检()
        print(time.strftime("%Y-%m-%d %H:%M:%S") + " 巡检")
        for x in r["拉"]:
            if "错" in x:
                print(f"  ✗ 拉清单 {x['家']}:{x['错']}")
            else:
                print(f"  · 拉清单 {x['家']}:{x['共']} 个"
                      + (f",新来 {', '.join(x['新来'])}" if x["新来"] else "")
                      + (f",不列了 {', '.join(x['不认了'])}" if x["不认了"] else ""))
        for x in r["测"]:
            print(f"  {'✓ 通 ' if x['通了'] else '✗ 不通'} {x['家']} / {x['模型']}"
                  + ("" if x["通了"] else f":{x['话']}"))
        for x in r["跳过"]:
            print(f"  - 没测 {x['家']} / {x['模型']}:{x['为什么']}")
        for x in r["在用不列了"]:
            print(f"  ⚠ {x['家']} 不再列 {x['模型']},还拨着它的功能:{'、'.join(x['功能'])}")
        for x in r["余额"]:
            print(f"  {'✗ 查余额 ' + x['家'] + ':' + x['错'] if '错' in x else '· ' + x['家'] + ' ' + x['余额']}")
    elif 动作 == "查余额":
        if len(argv) < 3:
            print("用法:python3 ai.py 查余额 <供应商名>")
            return 1
        try:
            print(查余额(argv[2])["余额"])
        except 底座错误 as e:
            print(e, file=sys.stderr)
            return 1
    elif 动作 == "到期日":
        if len(argv) < 4:
            print("用法:python3 ai.py 到期日 <供应商名> <2026-10-01|空>")
            return 1
        try:
            成 = 设到期日(argv[2], "" if argv[3] == "空" else argv[3])
        except 底座错误 as e:
            print(e, file=sys.stderr)
            return 1
        print("存好了" if 成 else f"供应商表里没有「{argv[2]}」")
        return 0 if 成 else 1
    elif 动作 == "挑档":
        if len(argv) < 3:
            print('用法:python3 ai.py 挑档 "<族名>" [<家>/<模型> …]')
            print('  照单办事:单子里有库里没有的建出来,库里有单子里没了的**删掉**。')
            print('  只给族名不给单子 = 把这条口自动建的档全删光(手工起名的那几档不动)。')
            return 1
        try:
            r = 设档(argv[2], argv[3:])
        except 底座错误 as e:
            print(e, file=sys.stderr)
            return 1
        print(f"「{r['族名']}」这条口:新建 {len(r['新建'])} 档、原有 {len(r['已有'])} 档、"
              f"删掉 {len(r['删掉'])} 档")
        for 名 in r["新建"]:
            print("  ＋ " + 名)
        for 名 in r["删掉"]:
            print("  － " + 名)
    elif 动作 == "删功能":
        if len(argv) != 3:
            print('用法:python3 ai.py 删功能 "<功能名>"')
            return 1
        改 = 删功能(argv[2])
        print(f"删了「{argv[2]}」" if 改 else f"功能表里本来就没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "删供应商":
        if len(argv) != 3:
            print('用法:python3 ai.py 删供应商 "<供应商名>"')
            return 1
        try:
            改 = 删供应商(argv[2])
        except 底座错误 as e:
            print(f"没删:{e}", file=sys.stderr)
            return 1
        print(f"删了「{argv[2]}」这一家" if 改 else f"供应商表里本来就没有「{argv[2]}」")
        return 0 if 改 else 1
    elif 动作 == "出图":
        if len(argv) != 5:
            print('用法:python3 ai.py 出图 "<功能名>" "<提示词>" <存到哪个文件>')
            return 1
        try:
            图, 格式 = 画图(argv[2], argv[3])
        except 底座错误 as e:
            print(f"失败:{e}", file=sys.stderr)
            return 1
        with open(argv[4], "wb") as f:
            f.write(图)
        print(f"出图了:{argv[4]} {len(图)} 字节 {格式}")
    elif 动作 == "探档位":
        if len(argv) < 4:
            print("用法:python3 ai.py 探档位 <供应商名> <模型>")
            return 1
        r = 探档位(argv[2], argv[3])
        说 = {"接口自报": "它认这几档:" + "、".join(r["档们"]),
             "不吃这一格": "这个模型没有推理强度这一格 —— 发什么它都不理",
             "探不出来": "问不出来,那一格照旧给候选值"}
        print(f"{argv[2]} / {argv[3]}:{说.get(r['来源'], r['来源'])}")
        print(f"  接口原话:{r['话'][:300]}")
    elif 动作 == "试":
        if len(argv) < 3:
            print('用法:python3 ai.py 试 "<功能名>" [提问]')
            return 1
        提问 = argv[3] if len(argv) > 3 else "用一句话说明你是谁、你是哪个模型。"
        try:
            print(问(argv[2], "你是一个助手,直接回答,不要客套。", 提问))
        except 底座错误 as e:
            print(f"失败:{e}", file=sys.stderr)
            return 1
    else:
        print(f"不认识的动作「{动作}」")
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

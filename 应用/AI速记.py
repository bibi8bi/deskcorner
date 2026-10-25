import json
import os
import re
import sys

import 公用

_仓根 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_路径文件 = os.path.join(_仓根, ".ai_base")
_声明文件 = os.path.join(_仓根, "插件.json")
_包内底座 = os.path.join(_仓根, "ai-base")


def 功能名表() -> dict:
    with open(_声明文件, encoding="utf-8") as f:
        声明 = json.load(f)["AI功能"]
    if 声明.get("版本") != 1:
        raise ValueError(f"{_声明文件} 的 AI功能.版本 只认 1,现在是 {声明.get('版本')!r}")
    return {r["标识"]: r["功能名"] for r in 声明["功能"]}


速记功能名 = 功能名表()["note"]
标题功能名 = 功能名表()["title"]

超时秒 = int(os.environ.get("待办_AI_超时", "180"))

输入上限 = 20000

_可产块 = {"text", "h", "ul", "ol", "todo", "code", "fold", "hr", "quote"}

系统提示 = """你是一个笔记整理助手。用户给你一段随手记的、口语的、没分段的文字,你把它整理成有条理的笔记。

只输出一个 JSON 数组,不要输出任何解释。数组里每一项是一个"块",可用的块只有这几种:

{"type":"h","text":"小标题","级":2}          级只能是 1、2、3(1 最大)
{"type":"text","text":"一段话"}
{"type":"quote","text":"引用的一段话"}
{"type":"ul","text":"并列的一条"}            一条一个块,不要把多条塞进一个块
{"type":"ol","text":"有先后顺序的一步"}       一步一个块
{"type":"todo","text":"要做的一件事","勾":false}
{"type":"code","text":"代码原文","lang":"python"}
{"type":"fold","标题":"次要的细节","text":"收起来的内容","展开":false}
{"type":"hr"}

硬规矩:
1. 只整理,不发挥。原文里没有的事实、数字、日期、人名、结论,一个都不许加。
2. 原文的信息一条都不许丢。看不懂或不知道该归到哪儿的,原样留成一个 text 块。
3. 原文里"要做的事"(要…/记得…/明天…/得…)整理成 todo 块,勾一律 false。
4. 有先后顺序的用 ol,并列的用 ul,成段的说明用 text。
5. 原文是中文就用中文,别翻译。原文的专有名词、型号、网址原样照抄,不许改写。
6. 内容不多的时候不要硬加小标题;三五句话就直接给几个块。
"""

拟标题提示 = """你是一个待办标题助手。读完用户给的正文后,只返回一行能概括这件事的标题。

硬规矩:
1. 标题不超过 40 个字。
2. 不要引号,不要“标题:”或“标题：”之类的前缀,不要解释。
3. 正文是中文就返回中文。
4. 只概括正文已有内容,不添加正文里没有的事实。
"""

_围栏 = re.compile(r"```[^\n]*\n(.*?)\n?```", re.DOTALL)


def 底座目录() -> str:
    根 = (os.environ.get("AI_BASE_DIR") or "").strip()
    if not 根 and os.path.isfile(_路径文件):
        with open(_路径文件, encoding="utf-8") as f:
            根 = f.read().strip()
    if not 根 and os.path.isfile(os.path.join(_包内底座, "ai.py")):
        根 = _包内底座
    return 根


def 敏感内容() -> bool:
    try:
        return 公用.读配置().get("AI敏感内容", True) is not False
    except (OSError, ValueError):
        return True


def _底座():
    根 = 底座目录()
    if not 根 or not os.path.isfile(os.path.join(根, "ai.py")):
        return None
    if 根 not in sys.path:
        sys.path.insert(0, 根)
    try:
        import ai
    except Exception:
        return None
    return ai


def 没接通原因(功能名: str) -> str:
    根 = 底座目录()
    if not 根:
        return (f"没告诉它 AI 底座在哪:把底座放到 {_包内底座},或在 {_路径文件} 里写一行底座文件夹的完整路径"
                f"(或设环境变量 AI_BASE_DIR)")
    if not os.path.isfile(os.path.join(根, "ai.py")):
        return f"按 {根} 去找 AI 底座,但那个文件夹里没有 ai.py —— 路径写错了或底座被挪走了"
    return f"AI 底座在 {根},但 import 不起来,或者它的功能表里没有「{功能名}」这一行"


def 可用(功能名: str = 速记功能名) -> bool:
    ai = _底座()
    if ai is None:
        return False
    try:
        配 = ai.读配置(日志条数=0)
    except Exception:
        return False
    功 = next((f for f in 配["功能"] if f["功能名"] == 功能名), None)
    if 功 is None:
        return False
    供 = next((s for s in 配["供应商"] if s["名"] == 功["主用供应商"]), None)
    if 供 is None:
        return False
    return bool(供["本机可用"]) and bool(供["有密钥"] or not 供["要密钥"])


def _问底座(功能名: str, system: str, user: str, 回执: dict | None = None):
    ai = _底座()
    if ai is None:
        return None, 没接通原因(功能名)
    try:
        return ai.问(功能名, system=system, user=user, 超时=超时秒, 回执=回执, 客户机密=敏感内容()), None
    except Exception as e:
        机密拒拨 = getattr(ai, "机密拒拨", None)
        if 机密拒拨 and isinstance(e, 机密拒拨):
            return None, str(e)[:300]
        return None, f"AI 这次没跑成:{str(e)[:300]}"


def _剥围栏(文本):
    m = _围栏.search(文本 or "")
    return m.group(1).strip() if m else (文本 or "").strip()


def _净块(v):
    if not isinstance(v, list):
        return None, 0
    出 = []
    丢 = 0
    for b in v:
        if not isinstance(b, dict):
            丢 += 1
            continue
        t = b.get("type")
        if t not in _可产块:
            丢 += 1
            continue
        文 = str(b.get("text") or "")
        if t == "hr":
            出.append({"type": "hr"})
        elif t == "h":
            try:
                级 = int(b.get("级") or 2)
            except (TypeError, ValueError):
                级 = 2
            出.append({"type": "h", "text": 文, "级": 级 if 级 in (1, 2, 3) else 2})
        elif t == "todo":
            出.append({"type": "todo", "text": 文, "勾": bool(b.get("勾"))})
        elif t == "code":
            nb = {"type": "code", "text": 文}
            lang = str(b.get("lang") or "").strip()[:20]
            if lang:
                nb["lang"] = lang
            出.append(nb)
        elif t == "fold":
            出.append({"type": "fold", "标题": str(b.get("标题") or ""),
                       "text": 文, "展开": bool(b.get("展开"))})
        else:
            出.append({"type": t, "text": 文})
    return 出, 丢


def 整理(文本):
    文本 = (文本 or "").strip()
    if not 文本:
        return {"ok": False, "error": "正文是空的,没什么可整理"}
    if len(文本) > 输入上限:
        return {"ok": False, "error": f"正文太长({len(文本)} 字),一次最多整理 {输入上限} 字"}
    执 = {}
    文, 错 = _问底座(速记功能名, 系统提示, 文本, 回执=执)
    if 错:
        return {"ok": False, "error": 错}
    return _带回执(_收整理稿(文), 执)


def _收整理稿(文):
    文 = _剥围栏(文)
    try:
        v = json.loads(文)
    except json.JSONDecodeError:
        return {"ok": True, "块": [{"type": "text", "text": 文}], "丢块": 0,
                "提示": "AI 这次没按格式回,已整段收成一个文字块"}
    块, 丢 = _净块(v)
    if 块 is None:
        return {"ok": False, "error": "AI 给的不是块数组"}
    if not 块:
        return {"ok": False, "error": "AI 整理出来是空的,再试一次或换句话说"}
    return {"ok": True, "块": 块, "丢块": 丢}


def _带回执(出, 执):
    if 出.get("ok") and 执:
        出["回执"] = 执
    return 出


def 速记接口(d):
    return 整理(d.get("文本"))


def 拟标题(正文文本):
    正文文本 = (正文文本 or "").strip()
    if not 正文文本:
        return {"ok": False, "error": "正文是空的,没什么可拟标题"}
    if len(正文文本) > 输入上限:
        return {"ok": False, "error": f"正文太长({len(正文文本)} 字),一次最多读取 {输入上限} 字"}
    执 = {}
    文, 错 = _问底座(标题功能名, 拟标题提示, 正文文本, 回执=执)
    if 错:
        return {"ok": False, "error": 错}
    return _带回执(_收标题(文), 执)


def _收标题(文):
    文 = _剥围栏(文)
    行 = next((x.strip() for x in (文 or "").splitlines() if x.strip()), "")
    行 = 行.strip(" 　\t`'\"“”‘’《》「」")
    行 = re.sub(r"^标题\s*[:：]\s*", "", 行)
    行 = 行.strip(" 　\t`'\"“”‘’《》「」")
    行 = re.sub(r"\s+", " ", 行)[:40].strip()
    if not 行:
        return {"ok": False, "error": "AI 没拟出标题,再试一次"}
    return {"ok": True, "标题": 行}


def 标题接口(d):
    return 拟标题(d.get("文本"))


本仓软件名 = "待办"


def _本仓族名(ai) -> set:
    名们 = set()
    for 头 in (速记功能名, 标题功能名):
        try:
            名们.update(r["功能名"] for r in ai.族(头))
        except Exception:
            pass
    return 名们


def _转发(功能名, 干):
    ai = _底座()
    if ai is None:
        return {"错": 没接通原因(功能名 or 速记功能名)}, 500
    try:
        if 功能名 and 功能名 not in _本仓族名(ai):
            return {"错": f"「{功能名}」不是待办这边的 AI 功能,这里只管「{速记功能名}」「{标题功能名}」两族"}, 400
        return 干(ai), 200
    except Exception as e:
        底座错误 = getattr(ai, "底座错误", None)
        return {"错": str(e)[:500]}, 400 if 底座错误 and isinstance(e, 底座错误) else 500


def 模型牌族(功能名):
    功能名 = (功能名 or "").strip()
    if not 功能名:
        return {"错": "没给功能名"}, 400
    return _转发(功能名, lambda ai: {"行们": ai.族(功能名)})


def 模型牌挪(体):
    功能名 = str((体 or {}).get("功能名") or "").strip()
    if not 功能名:
        return {"错": "没给功能名"}, 400
    方向 = (体 or {}).get("方向")

    def 干(ai):
        出 = ai.挪一格(功能名, 方向)
        这一行 = 出.get("这一行") or 功能名
        return {"行们": ai.族(这一行), "这一行": 这一行}
    return _转发(功能名, 干)


def 调用历史(功能名="", 软件="", 条数=20):
    功能名 = (功能名 or "").strip()
    软件 = (软件 or "").strip()
    if 软件 and 软件 != 本仓软件名:
        return {"错": f"这里只看「{本仓软件名}」自己的调用历史"}, 400
    if not 功能名:
        软件 = 本仓软件名
    try:
        条数 = max(1, min(int(条数 or 20), 100))
    except (TypeError, ValueError):
        条数 = 20
    if 功能名:
        return _转发(功能名, lambda ai: ai.历史(功能名, 条数=条数))
    return _转发("", lambda ai: ai.历史(软件=软件, 条数=条数))

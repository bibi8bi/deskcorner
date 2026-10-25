import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ai
import panel


class MemorySocket:
    def __init__(self, raw):
        self.input = io.BytesIO(raw)
        self.output = bytearray()

    def makefile(self, *args):
        return self.input

    def sendall(self, data):
        self.output.extend(data)


class ModelUpdates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.addCleanup(self.tmp.cleanup)
        self.db = str(Path(self.tmp.name) / "test.db")
        self.addCleanup(setattr, ai, "本机增强文件", ai._自检铺本机增强(self.tmp.name))
        ai.加供应商("测试 GPT", "网页接口", "https://example.invalid/v1/chat/completions",
                  "gpt-8-sol,gpt-8.1-sol,gpt-8-luna,gpt-8.1-luna,gpt-9-astra,gpt-9-sol-preview", 库=self.db)
        ai.设密钥("测试 GPT", "fixture-key", 库=self.db)
        ai.加功能("演示 · 提炼", "文本", "测试 GPT", "gpt-8-sol", 库=self.db)
        ai.设用力("演示 · 提炼", "high", 库=self.db)
        ai.加备选("演示 · 提炼", "测试 GPT", "gpt-8-luna", 库=self.db)
        self.probes = []
        self.network = patch.object(ai.urllib.request, "urlopen", side_effect=AssertionError("禁止真实上游请求"))
        self.network.start()
        self.addCleanup(self.network.stop)

    def api(self):
        self.assertTrue(hasattr(ai, "模型更新预览"), "缺少自动发现与批量换新入口")

    def rows(self):
        c = ai.连库(self.db)
        try:
            return [dict(r) for r in c.execute("SELECT * FROM 功能 ORDER BY 功能名")]
        finally:
            c.close()

    def probe(self, supplier, model, 库=None, **kwargs):
        self.probes.append((supplier, model))
        c = ai.连库(库)
        try:
            s = c.execute("SELECT * FROM 供应商 WHERE 名=?", (supplier,)).fetchone()
            ai._记一格(c, supplier, model, 强度档="low,medium,high,xhigh,max",
                       档位来源="接口自报", 档位探于="fixture",
                       档位指纹=ai._通道指纹(s["类型"], s["地址"], model))
        finally:
            c.close()
        return {"来源": "接口自报", "档们": ["low", "medium", "high", "xhigh", "max"]}

    def picks(self, preview):
        return [{"功能名": r["功能名"], "新模型": r["新模型"]} for r in preview["更新"]]

    def apply(self, preview=None):
        self.api()
        preview = preview or ai.模型更新预览(库=self.db)
        with patch.object(ai, "探档位", self.probe):
            return ai.应用模型更新(preview["指纹"], self.picks(preview), 库=self.db)

    def test_numeric_versions_and_series(self):
        self.api()
        choose = ai._新版模型
        self.assertEqual(choose("gpt-8-sol", ["gpt-8.2-sol", "gpt-8.10-sol", "gpt-9-luna"]), "gpt-8.10-sol")
        self.assertIsNone(choose("gpt-8-sol", ["gpt-8.1-sol-preview", "gpt-9-astra", "gpt-8-sol-20261001"]))
        self.assertIsNone(choose("gpt-8-luna", ["gpt-8.1-sol"]))
        self.assertEqual(choose("claude-sonnet-8-1", ["claude-sonnet-8-2", "claude-opus-9"]), "claude-sonnet-8-2")
        self.assertEqual(choose("claude-opus-8-1-20260101", ["opus"], 命令行=True), "opus")
        self.assertIsNone(choose("sonnet", ["sonnet"], 命令行=True))
        self.assertEqual(choose("claude-opus-8-20260101", ["claude-opus-8-20260201"]), "claude-opus-8-20260201")
        self.assertEqual(choose("claude-opus-8-20260201", ["claude-opus-8-2"]), "claude-opus-8-2")
        self.assertIsNone(choose("gpt-8-sol", ["gpt-8.0-sol"]))
        self.assertIsNone(choose("gpt-8.1-sol", ["gpt-8.1.0-sol"]))

    def test_preview_is_local_and_excludes_hidden_disabled_images(self):
        self.api()
        before = self.rows()
        with patch.object(ai.urllib.request, "urlopen", side_effect=AssertionError("预览不联网")):
            p = ai.模型更新预览(库=self.db)
        self.assertEqual({r["新模型"] for r in p["更新"]}, {"gpt-8.1-sol", "gpt-8.1-luna"})
        self.assertEqual(before, self.rows())
        ai.藏("测试 GPT", "gpt-8.1-sol", 库=self.db)
        ai.设启用("演示 · 提炼 · 测试 GPT/gpt-8-luna", False, 库=self.db)
        ai.加功能("演示 · 生图", "生图", "测试 GPT", "gpt-8-sol", 库=self.db)
        self.assertEqual(ai.模型更新预览(库=self.db)["更新"], [])

    def test_apply_and_undo_preserve_entire_family(self):
        before = self.rows()
        out = self.apply()
        self.assertEqual(out["数量"], 2)
        changed = [r for r in self.rows() if r["功能名"].startswith("演示 · 提炼")]
        self.assertEqual({r["主用模型"] for r in changed}, {"gpt-8.1-sol", "gpt-8.1-luna"})
        self.assertEqual([r["顺序"] for r in changed], [r["顺序"] for r in before if r["功能名"].startswith("演示 · 提炼")])
        self.assertEqual({r["用力"] for r in changed}, {"high", "关"})
        self.assertEqual(len(self.probes), 2)
        ai.撤回模型更新(out["撤回"], 库=self.db)
        self.assertEqual(before, self.rows())

    def test_stale_preview_is_rejected_before_probe(self):
        self.api()
        p = ai.模型更新预览(库=self.db)
        ai.设用力("演示 · 提炼", "low", 库=self.db)
        before = self.rows()
        with self.assertRaises(ai.底座错误), patch.object(ai, "探档位", self.probe):
            ai.应用模型更新(p["指纹"], self.picks(p), 库=self.db)
        self.assertEqual(self.probes, [])
        self.assertEqual(before, self.rows())

    def test_compatibility_failure_changes_no_routes(self):
        self.api()
        before = self.rows()
        with patch.object(ai, "探档位", return_value={"来源": "探不出来", "档们": []}):
            with self.assertRaises(ai.底座错误):
                ai.应用模型更新(ai.模型更新预览(库=self.db)["指纹"], self.picks(ai.模型更新预览(库=self.db)), 库=self.db)
        self.assertEqual(before, self.rows())

    def test_change_during_probe_is_rejected(self):
        self.api()
        p = ai.模型更新预览(库=self.db)
        def edit(s, m, **kw):
            result = self.probe(s, m, **kw)
            ai.设用力("演示 · 提炼", "medium", 库=self.db)
            return result
        with patch.object(ai, "探档位", edit), self.assertRaises(ai.底座错误):
            ai.应用模型更新(p["指纹"], self.picks(p), 库=self.db)
        self.assertEqual(next(r for r in self.rows() if r["功能名"] == "演示 · 提炼")["主用模型"], "gpt-8-sol")

    def test_undo_refuses_later_family_edit(self):
        out = self.apply()
        ai.设用力("演示 · 提炼", "low", 库=self.db)
        before = self.rows()
        with self.assertRaises(ai.底座错误):
            ai.撤回模型更新(out["撤回"], 库=self.db)
        self.assertEqual(before, self.rows())

    def test_undo_allows_unrelated_edit(self):
        out = self.apply()
        ai.设用力("示例 · 生成", "high", 库=self.db)
        ai.撤回模型更新(out["撤回"], 库=self.db)
        self.assertEqual(next(r for r in self.rows() if r["功能名"] == "示例 · 生成")["用力"], "high")

    def test_refresh_failure_does_not_switch_routes(self):
        self.api()
        before = self.rows()
        with patch.object(ai, "问模型清单", side_effect=ai.底座错误("fixture unavailable")):
            p = ai.检查模型更新(库=self.db)
        self.assertEqual(p["刷新"][0]["错"], "fixture unavailable")
        self.assertEqual(before, self.rows())
        self.assertEqual(p["更新"], [], "本次没有拿到清单的家不可用旧清单推荐")

    def test_missing_effort_is_rejected_and_atomic_failure_rolls_back(self):
        self.api()
        p = ai.模型更新预览(库=self.db)
        before = self.rows()
        def low_only(s, m, **kw):
            result = self.probe(s, m, **kw)
            c = ai.连库(self.db)
            try:
                ai._记一格(c, s, m, 强度档="low")
            finally:
                c.close()
            return result
        with patch.object(ai, "探档位", low_only), self.assertRaises(ai.底座错误):
            ai.应用模型更新(p["指纹"], self.picks(p), 库=self.db)
        self.assertEqual(before, self.rows())
        for row in p["更新"]:
            self.probe(row["供应商"], row["新模型"], 库=self.db)
        with patch.object(ai, "_名随设定", side_effect=ai.底座错误("fixture rename conflict")):
            with self.assertRaises(ai.底座错误):
                ai.应用模型更新(p["指纹"], self.picks(p), 库=self.db)
        self.assertEqual(before, self.rows())

    def test_same_target_is_probed_once_and_unknown_suffix_not_guessed(self):
        self.api()
        ai.加功能("演示 · 第二个", "文本", "测试 GPT", "gpt-8-sol", 库=self.db)
        self.apply()
        self.assertEqual(self.probes.count(("测试 GPT", "gpt-8.1-sol")), 1)
        self.assertIsNone(ai._新版模型("gpt-8-terra", ["gpt-8.1-sol"]))

    def http(self, path, body=None, auth=True, server=None, raw_result=False):
        payload = json.dumps(body).encode() if body is not None else b""
        query = "?k=fixture-token" if auth else ""
        method = "POST" if body is not None else "GET"
        raw = f"{method} {path}{query} HTTP/1.0\r\nHost: localhost\r\nContent-Length: {len(payload)}\r\n\r\n".encode() + payload
        sock = MemorySocket(raw)
        with patch.object(panel.门, "库", self.db), patch.object(panel.门, "口令", "fixture-token"):
            panel.门(sock, ("127.0.0.1", 12345), server or SimpleNamespace())
        header, data = bytes(sock.output).split(b"\r\n\r\n", 1)
        return int(header.split()[1]), (header, data) if raw_result else json.loads(data)

    def test_http_auth_apply_refresh_undo_and_no_uploaded_backup(self):
        self.api()
        server = SimpleNamespace()
        self.assertEqual(self.http("/api/model-updates/apply", {}, auth=False, server=server)[0], 403)
        self.assertEqual(self.http("/api/model-updates/check", {}, auth=False, server=server)[0], 403)
        self.assertEqual(self.http("/api/model-updates/undo", {}, auth=False, server=server)[0], 403)
        code, state = self.http("/api/state", server=server)
        self.assertEqual(code, 200)
        self.assertNotIn("fixture-key", json.dumps(state))
        with patch.object(ai, "探档位", self.probe):
            code, result = self.http("/api/model-updates/apply", {"指纹": state["模型更新"]["指纹"], "选中": self.picks(state["模型更新"])}, server=server)
        self.assertTrue(result["成了"])
        self.assertNotIn("撤回", result)
        token = self.http("/api/state", server=server)[1]["模型更新"]["撤回令牌"]
        self.assertTrue(token)
        wrong = self.http("/api/model-updates/undo", {"令牌": "forged", "回执": {"前": []}}, server=server)[1]
        self.assertFalse(wrong["成了"])
        undone = self.http("/api/model-updates/undo", {"令牌": token}, server=server)[1]
        self.assertTrue(undone["成了"])
        self.assertFalse(self.http("/api/model-updates/undo", {"令牌": token}, server=server)[1]["成了"])

    def test_http_failed_refresh_cannot_apply_old_list(self):
        self.api()
        server = SimpleNamespace()
        fingerprint = self.http("/api/state", server=server)[1]["模型更新"]["指纹"]
        with patch.object(ai, "问模型清单", side_effect=ai.底座错误("fixture offline")):
            result = self.http("/api/model-updates/check", {}, server=server)[1]
        self.assertEqual(result["模型更新"]["指纹"], "")
        result = self.http("/api/model-updates/apply", {"指纹": fingerprint}, server=server)[1]
        self.assertFalse(result["成了"])
        self.assertEqual(self.http("/api/state", server=server)[1]["模型更新"]["指纹"], "")

    def test_refresh_error_redacts_key_before_response_and_state(self):
        self.api()
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"unexpected": "fixture-key"}'
        server = SimpleNamespace()
        with patch.object(ai.urllib.request, "urlopen", return_value=Response()):
            result = self.http("/api/model-updates/check", {}, server=server)[1]
        self.assertNotIn("fixture-key", json.dumps(result))
        self.assertNotIn("fixture-key", json.dumps(self.http("/api/state", server=server)[1]))

    def test_changed_key_invalidates_preview_before_probe(self):
        self.api()
        p = ai.模型更新预览(库=self.db)
        ai.设密钥("测试 GPT", "fixture-other-key", 库=self.db)
        with patch.object(ai, "探档位", self.probe), self.assertRaises(ai.底座错误):
            ai.应用模型更新(p["指纹"], self.picks(p), 库=self.db)
        self.assertEqual(self.probes, [])

    def test_refresh_error_redacts_before_truncation(self):
        self.api()
        key = "fixture-private-key-" + "q" * 100
        ai.设密钥("测试 GPT", key, 库=self.db)
        body = json.dumps({"unexpected": "x" * 150 + key}).encode()
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return body
        server = SimpleNamespace()
        with patch.object(ai.urllib.request, "urlopen", return_value=Response()):
            result = self.http("/api/model-updates/check", {}, server=server)[1]
        self.assertNotIn("fixture-private", json.dumps(result))
        self.assertNotIn("fixture-private", json.dumps(self.http("/api/state", server=server)[1]))

    def test_changed_provider_effort_invalidates_preview(self):
        self.api()
        p = ai.模型更新预览(库=self.db)
        c = ai.连库(self.db)
        try:
            c.execute("UPDATE 供应商 SET 强度档='low' WHERE 名='测试 GPT'")
        finally:
            c.close()
        with patch.object(ai, "探档位", self.probe), self.assertRaises(ai.底座错误):
            ai.应用模型更新(p["指纹"], self.picks(p), 库=self.db)
        self.assertEqual(self.probes, [])

    def test_key_rotated_during_refresh_redacts_request_key(self):
        self.api()
        key = "fixture-request-private-" + "q" * 100
        text = "x" * 150 + key
        for mode in ("body", "error"):
            with self.subTest(mode=mode):
                ai.设密钥("测试 GPT", key, 库=self.db)
                db = self.db
                class Response:
                    def __enter__(self): return self
                    def __exit__(self, *args): pass
                    def read(self):
                        ai.设密钥("测试 GPT", "fixture-new-private-key", 库=db)
                        if mode == "error":
                            raise OSError(text)
                        return json.dumps({"unexpected": text}).encode()
                server = SimpleNamespace()
                with patch.object(ai.urllib.request, "urlopen", return_value=Response()):
                    result = self.http("/api/model-updates/check", {}, server=server)[1]
                self.assertNotIn("fixture-request", json.dumps(result))
                self.assertNotIn("fixture-request", json.dumps(self.http("/api/state", server=server)[1]))


    def test_selected_primary_manual_target_and_undo(self):
        before = self.rows()
        p = ai.模型更新预览(库=self.db)
        with patch.object(ai, "探档位", self.probe):
            r = ai.应用模型更新(p["指纹"], [{"功能名": "演示 · 提炼", "新模型": "gpt-9-astra"}], 库=self.db)
        after = self.rows()
        self.assertEqual(r["数量"], 1)
        self.assertEqual(next(x for x in after if x["功能名"] == "演示 · 提炼")["主用模型"], "gpt-9-astra")
        self.assertEqual([x for x in before if x["父功能"]], [x for x in after if x["父功能"]])
        ai.撤回模型更新(r["撤回"], 库=self.db)
        self.assertEqual(before, self.rows())

    def test_selected_backup_only(self):
        p = ai.模型更新预览(库=self.db)
        row = next(r for r in p["更新"] if r["父功能"])
        with patch.object(ai, "探档位", self.probe):
            result = ai.应用模型更新(p["指纹"], [{"功能名": row["功能名"], "新模型": "gpt-9-astra"}], 库=self.db)
        self.assertEqual(result["数量"], 1)
        self.assertEqual(next(r for r in self.rows() if r["功能名"] == "演示 · 提炼")["主用模型"], "gpt-8-sol")
        self.assertIn("演示 · 提炼 · 测试 GPT/gpt-9-astra", [r["功能名"] for r in self.rows()])

    def test_invalid_or_hidden_target_rejects_whole_batch_before_probe(self):
        for target in ("invented", "gpt-9-astra"):
            ai.藏("测试 GPT", "gpt-9-astra", 库=self.db)
            p = ai.模型更新预览(库=self.db)
            picks = self.picks(p)
            picks[-1]["新模型"] = target
            before = self.rows()
            with patch.object(ai, "探档位", self.probe), self.assertRaises(ai.底座错误):
                ai.应用模型更新(p["指纹"], picks, 库=self.db)
            self.assertEqual(before, self.rows())
            self.assertEqual(self.probes, [])

    def test_fixed_row_toggle_and_stale_fingerprint(self):
        self.assertTrue(hasattr(ai, "设不提新版"), "缺少不再提示新版开关")
        old = ai.模型更新预览(库=self.db)
        ai.设不提新版("演示 · 提炼", True, 库=self.db)
        p = ai.模型更新预览(库=self.db)
        self.assertIn("演示 · 提炼", [r["功能名"] for r in p["已固定"]])
        self.assertNotIn("演示 · 提炼", [r["功能名"] for r in p["更新"]])
        picks = [{"功能名": "演示 · 提炼", "新模型": "gpt-9-astra"}]
        for fingerprint in (p["指纹"], old["指纹"]):
            with patch.object(ai, "探档位", self.probe), self.assertRaises(ai.底座错误):
                ai.应用模型更新(fingerprint, picks, 库=self.db)
        self.assertEqual(self.probes, [])
        ai.设不提新版("演示 · 提炼", False, 库=self.db)
        self.assertIn("演示 · 提炼", [r["功能名"] for r in ai.模型更新预览(库=self.db)["更新"]])

    def test_all_rows_have_options_status_and_noop_does_not_probe(self):
        p = ai.模型更新预览(库=self.db)
        self.assertIn("行", p, "预览缺少逐行状态与模型选项")
        for r in p["行"]:
            for key in ("功能名", "父功能", "供应商", "旧模型", "新模型", "可选模型", "用力", "状态", "不提新版"):
                self.assertIn(key, r)
        row = next(r for r in p["行"] if r["功能名"] == "演示 · 提炼")
        with patch.object(ai, "探档位", self.probe):
            result = ai.应用模型更新(p["指纹"], [{"功能名": row["功能名"], "新模型": row["旧模型"]}], 库=self.db)
        self.assertEqual(result["数量"], 0)
        self.assertEqual(self.probes, [])

    def test_http_fixed_switch_and_explicit_selection_required(self):
        server = SimpleNamespace()
        self.assertEqual(self.http("/api/model-updates/fixed", {"功能名": "演示 · 提炼", "不提新版": True}, auth=False, server=server)[0], 403)
        result = self.http("/api/model-updates/fixed", {"功能名": "演示 · 提炼", "不提新版": True}, server=server)[1]
        self.assertTrue(result["成了"])
        self.assertEqual(result["模型更新"]["已固定"][0]["功能名"], "演示 · 提炼")
        self.assertEqual(self.http("/api/model-updates/fixed", {"功能名": "演示 · 提炼", "不提新版": "false"}, server=server)[0], 400)
        p = result["模型更新"]
        with patch.object(ai, "探档位", self.probe):
            result = self.http("/api/model-updates/apply", {"指纹": p["指纹"]}, server=server)[1]
        self.assertFalse(result["成了"])
        self.assertEqual(self.probes, [])


    def test_static_page_and_script_are_registered_and_authenticated(self):
        from urllib.parse import quote
        for path, mime in (("/模型更新.html", b"text/html"), ("/模型更新.js", b"text/javascript")):
            code, (headers, data) = self.http(quote(path), raw_result=True)
            self.assertEqual(code, 200)
            self.assertIn(mime, headers)
            self.assertTrue(data)
            self.assertEqual(self.http(quote(path), auth=False)[0], 403)

    def test_migration_defaults_old_rows_to_unfixed(self):
        before = self.rows()
        c = ai.连库(self.db)
        c.execute("ALTER TABLE 功能 DROP COLUMN 不提新版")
        c.close()
        self.assertEqual(before, self.rows())
        self.assertTrue(all(r["不提新版"] == 0 for r in self.rows()))

    def test_cli_alias_choices_and_latest_missing_blocked_states(self):
        ai.加功能("演示 · 客户端", "文本", ai._测CL, "sonnet", 库=self.db)
        ai.加功能("演示 · 最新", "文本", "测试 GPT", "gpt-9-astra", 库=self.db)
        ai.加功能("演示 · 缺失", "文本", "测试 GPT", "gpt-9-other", 库=self.db)
        ai.设同意(ai._测CL, True, 库=self.db)
        with patch.object(ai, "本机可用", return_value=True):
            rows = {r["功能名"]: r for r in ai.模型更新预览(库=self.db)["行"]}
        self.assertEqual(rows["演示 · 客户端"]["状态"], "客户端定版本")
        self.assertEqual(rows["演示 · 客户端"]["可选模型"], ["sonnet", "opus", "haiku"])
        self.assertEqual(rows["演示 · 最新"]["状态"], "已是最新")
        self.assertEqual(rows["演示 · 缺失"]["状态"], "清单里没有当前模型")
        ai.设密钥("测试 GPT", "", 库=self.db)
        rows = {r["功能名"]: r for r in ai.模型更新预览(库=self.db)["行"]}
        self.assertEqual(rows["演示 · 最新"]["状态"], "拨不动")
        self.assertTrue(rows["演示 · 最新"]["原因"])

    def test_failed_refresh_rows_are_not_recommended(self):
        with patch.object(ai, "问模型清单", side_effect=ai.底座错误("fixture offline")):
            p = ai.检查模型更新(库=self.db)
        rows = [r for r in p["行"] if r["供应商"] == "测试 GPT"]
        self.assertTrue(all(r["状态"] == "拨不动" and not r["新模型"] for r in rows))
        self.assertTrue(all(r["原因"] == "fixture offline" for r in rows))


if __name__ == "__main__":
    unittest.main()

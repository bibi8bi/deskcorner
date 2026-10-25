import concurrent.futures
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import ai


def declaration(root, software, names, kinds=None):
    path = Path(root) / (software + '.json')
    rows = [{'标识': str(i), '功能名': name, '种类': (kinds or {}).get(name, '文本'),
             '说明': name + '用途'} for i, name in enumerate(names)]
    path.write_text(json.dumps({'名': software, 'AI功能': {'版本': 1, '功能': rows}}, ensure_ascii=False))
    return str(path.resolve())


class InstalledFeatures(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = str(Path(self.tmp.name) / 'config.db')
        self.addCleanup(setattr, ai, '本机增强文件', ai._自检铺本机增强(self.tmp.name))
        self.panel = declaration(self.tmp.name, 'words', ['笔记 · 打标签', '笔记 · 校对'])
        self.demo = declaration(self.tmp.name, 'demo', ['示例 · 生成', '示例 · 润色'])
        self.net = patch('urllib.request.urlopen', side_effect=AssertionError('禁止外部请求'))
        self.net.start()
        self.addCleanup(self.net.stop)

    def sync(self, paths):
        self.assertTrue(hasattr(ai, '_同步安装声明'), '仅装笔记软件应建笔记两行且不建示例行：缺少声明同步实现')
        return ai._同步安装声明(paths, self.db)

    def rows(self):
        with sqlite3.connect(self.db) as c:
            c.row_factory = sqlite3.Row
            return [dict(r) for r in c.execute('SELECT * FROM 功能 ORDER BY 功能名')]

    def test_only_panel(self):
        self.sync([self.panel])
        self.assertEqual({r['功能名'] for r in self.rows()}, {'笔记 · 打标签', '笔记 · 校对'})
        self.assertEqual(len(ai.读配置(self.db)['功能']), 2)
        self.assertTrue(all(r['主用模型'] == ai._DS模型.split(',')[0] for r in self.rows()))

    def test_install_uninstall_reinstall_empty_unknown(self):
        unknown = self.sync(None)
        self.assertFalse(unknown['已知'])
        self.assertFalse(Path(self.db).exists(), '未知范围的同步不能碰库')
        self.sync([])
        self.assertEqual(ai.读配置(self.db)['功能'], [])
        self.sync([self.demo])
        self.assertEqual(len(self.rows()), 2)
        self.sync([self.panel, self.demo])
        before = self.rows()
        self.sync([self.panel])
        self.sync([])
        self.sync([self.panel, self.demo])
        self.assertEqual(before, self.rows())
        self.assertEqual(len(before), 4)

    def test_old_rows_untouched(self):
        ai.连库(self.db).close()
        with sqlite3.connect(self.db) as c:
            c.execute("UPDATE 功能 SET 说明='',备注='人写',启用=0,用力='好好想',父功能=NULL,顺序=NULL,主用模型='定制'")
        before = self.rows()
        self.sync([self.panel, self.demo])
        ai.读配置(self.db)
        self.assertEqual(before, [r for r in self.rows() if r['功能名'].startswith('示例')])

    def test_migration_preserves_every_existing_column(self):
        with sqlite3.connect(self.db) as c:
            c.row_factory = sqlite3.Row
            c.executescript(ai.建表)
            c.execute("INSERT INTO 功能(功能名,主用供应商,主用模型,备用供应商,备用模型,种类,启用,用力,说明,备注,父功能,顺序) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", ('示例 · 生成','自定','m','备用家','b','生图',0,'好好想','','用户备注',None,None))
            before = dict(c.execute('SELECT * FROM 功能').fetchone())
        self.assertNotIn('需求种类', before)
        self.sync([self.panel,self.demo])
        after = next(r for r in self.rows() if r['功能名']=='示例 · 生成')
        self.assertEqual(before, {key:after[key] for key in before})
        self.assertIsNone(after['需求种类'])

    def test_insert_failure_rolls_back_whole_batch(self):
        self.sync([])
        with sqlite3.connect(self.db) as c:
            c.execute("CREATE TRIGGER reject_second BEFORE INSERT ON 功能 WHEN NEW.功能名='笔记 · 校对' BEGIN SELECT RAISE(ABORT,'fixture'); END")
        with self.assertRaises(sqlite3.IntegrityError):
            self.sync([self.panel])
        self.assertEqual(self.rows(), [])

    def test_bad_batch_does_not_create_or_change(self):
        duplicate = declaration(self.tmp.name, 'duplicate', ['笔记 · 打标签'])
        bad = Path(self.tmp.name) / 'bad.json'
        bad.write_text('{')
        unsupported = Path(self.tmp.name) / 'unsupported.json'
        unsupported.write_text('{"名":"test","AI功能":{"版本":2,"功能":[]}}')
        for wrong in [str(bad), str(unsupported), str(bad) + '.missing', duplicate]:
            with self.subTest(wrong=wrong):
                with self.assertRaises(ai.底座错误):
                    self.sync([self.panel, wrong])
                self.assertFalse(Path(self.db).exists())
        self.sync([self.demo])
        before = self.rows()
        with self.assertRaises(ai.底座错误):
            self.sync([self.panel, str(bad)])
        self.assertEqual(before, self.rows())

    def test_schema_and_duplicates(self):
        for payload in [None, {}, {'版本': True, '功能': []}, {'版本': 1, '功能': {}},
                        {'版本': 1, '功能': [{'标识': 'x', '功能名': 'a', '种类': '音频', '说明': 'a'}]},
                        {'版本': 1, '功能': [{'标识': 'x', '功能名': 'a', '种类': '文本', '说明': 'a', '模型':'x'}]}]:
            path = Path(self.tmp.name) / 'invalid.json'
            path.write_text(json.dumps({'名': 'test', 'AI功能': payload}))
            with self.subTest(payload=payload), self.assertRaises(ai.底座错误):
                self.sync([str(path)])
        with self.assertRaises(ai.底座错误):
            self.sync([self.panel, self.panel])

    def test_concurrent_and_repeat(self):
        code = 'import ai,sys;ai.本机增强文件=sys.argv[3];ai._同步安装声明([sys.argv[1]],sys.argv[2])'
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: subprocess.run([sys.executable, '-B', '-c', code, self.panel, self.db, ai.本机增强文件], capture_output=True, text=True), range(2)))
        for r in results:
            self.assertEqual(r.returncode, 0, r.stderr)
        before = self.rows()
        self.sync([self.panel])
        self.assertEqual(before, self.rows())

    def test_vision_cannot_be_configured_to_text_only(self):
        path = declaration(self.tmp.name, 'vision', ['测 · 看图'], {'测 · 看图':'看图'})
        self.sync([path])
        ai.设路由('测 · 看图', 'DeepSeek', ai._DS模型.split(',')[0], 库=self.db)
        self.assertIn('看图', ai.读配置(self.db)['功能'][0]['拨不动理由'])
        with self.assertRaisesRegex(ai.底座错误, '看图'):
            ai.问('测 · 看图', 's', 'u', 库=self.db)

    def test_direct_backup_inherits_vision_requirement(self):
        path = declaration(self.tmp.name, 'vision', ['测 · 看图'], {'测 · 看图':'看图'})
        self.sync([path])
        ai.加备选('测 · 看图','DeepSeek',ai._DS模型.split(',')[0],库=self.db)
        ai.设密钥('DeepSeek','fake',库=self.db)
        backup = next(f for f in ai.读配置(self.db)['功能'] if f['父功能']=='测 · 看图')
        self.assertIn('看图',backup['拨不动理由'])
        with self.assertRaisesRegex(ai.底座错误,'看图'):
            ai.问(backup['功能名'],'s','u',库=self.db)

    def test_candidate_prefix_and_sort(self):
        self.sync([])
        for name, consent, key in [('a订阅', True, 'fake'), ('b付费', False, 'fake'), ('c未配', False, '')]:
            ai.加供应商(name, '网页接口', 'https://example.invalid/chat/completions', 'v1,v2', 库=self.db)
            ai.设密钥(name, key, 库=self.db)
            ai.设吃订阅(name, consent, 库=self.db)
            if consent:
                ai.设同意(name, True, 库=self.db)
            ai.设只收前缀(name, 'v2', 库=self.db)
            with sqlite3.connect(self.db) as c:
                c.executemany("INSERT INTO 模型笔记(供应商,模型,看图,看图来源) VALUES(?,?,'能','测试')", [(name,'v1'),(name,'v2')])
        path = declaration(self.tmp.name, 'vision', ['测 · 看图'], {'测 · 看图':'看图'})
        self.sync([path])
        row = self.rows()[0]
        self.assertEqual((row['主用供应商'],row['主用模型']), ('b付费','v2'))

    def test_capability_no_candidate_blocks_send(self):
        path = declaration(self.tmp.name, 'image', ['测 · 看图', '测 · 生图'], {'测 · 看图': '看图', '测 · 生图': '生图'})
        self.sync([path])
        self.assertTrue(all(not r['主用供应商'] and not r['主用模型'] for r in self.rows()))
        self.assertEqual({r['种类'] for r in self.rows()}, {'文本', '生图'})
        for name, fn, kw in [('测 · 看图', ai.问, {'system':'s','user':'u'}), ('测 · 生图', ai.画图, {'提示词':'x'})]:
            with self.assertRaisesRegex(ai.底座错误, '待配置'):
                fn(name, 库=self.db, **kw)
        self.assertTrue(all('待配置' in f['拨不动理由'] for f in ai.读配置(self.db)['功能']))

    def test_capability_candidates_and_no_consent(self):
        self.sync([])
        ai.加供应商('视觉', '网页接口', 'https://example.invalid/chat/completions', 'vision', 库=self.db)
        ai.设密钥('视觉', 'fake', 库=self.db)
        with sqlite3.connect(self.db) as c:
            c.execute("INSERT INTO 模型笔记(供应商,模型,看图,看图来源) VALUES('视觉','vision','能','测试')")
        ai.加供应商('图像', '网页接口', 'https://example.invalid/images/generations', 'image', 库=self.db)
        ai.设密钥('图像', 'fake', 库=self.db)
        catalog = [{'名':'图像','种类':'生图','地址':'https://example.invalid/images/generations','模型们':'image'}]
        path = declaration(self.tmp.name, 'image', ['测 · 看图', '测 · 生图'], {'测 · 看图':'看图','测 · 生图':'生图'})
        with patch.object(ai, '名册', return_value=catalog):
            self.sync([path])
        by = {r['功能名']:r for r in self.rows()}
        self.assertEqual(by['测 · 看图']['主用供应商'], '视觉')
        self.assertEqual(by['测 · 生图']['主用供应商'], '图像')
        self.assertFalse(next(s for s in ai.读配置(self.db)['供应商'] if s['名']==ai._测CL)['已同意'])


class PanelInstalled(InstalledFeatures):
    def test_http_state_and_startup_cli(self):
        import panel
        from test_model_updates import MemorySocket
        from types import SimpleNamespace
        root = Path(__file__).resolve().parents[1]
        env = dict(os.environ, AI_BASE_DB=self.db, PYTHONDONTWRITEBYTECODE='1')
        args = [sys.executable, '-B', str(root/'panel.py'), self.db, '--只补功能']
        first = subprocess.run(args + ['--功能声明', self.panel, '--功能声明', self.demo], env=env, capture_output=True, text=True)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(len(self.rows()), 4)
        failed = subprocess.run(args + ['--功能声明', self.panel+'.missing'], env=env, capture_output=True, text=True)
        self.assertEqual(failed.returncode, 2)
        conflict = subprocess.run(args + ['--无已装软件', '--功能声明', self.panel], env=env, capture_output=True, text=True)
        self.assertEqual(conflict.returncode, 2)
        no_scope = subprocess.run(args, env=env, capture_output=True, text=True)
        self.assertEqual(no_scope.returncode, 2)
        scope = self.sync([self.panel])
        raw = b'GET /api/state?k=fixture-token HTTP/1.0\r\nHost: localhost\r\n\r\n'
        sock = MemorySocket(raw)
        with patch.object(panel.门, '库', self.db), patch.object(panel.门, '口令', 'fixture-token'), patch.object(panel.门, '安装范围', scope):
            panel.门(sock, ('127.0.0.1',12345), SimpleNamespace())
        header, data = bytes(sock.output).split(b'\r\n\r\n',1)
        self.assertEqual(int(header.split()[1]),200)
        state = json.loads(data)
        self.assertEqual(state['安装范围']['功能名'], ['笔记 · 打标签','笔记 · 校对'])
        self.assertEqual(len(state['功能']),4, '未装行保留供独立管理')
        with patch.object(panel, '起', return_value=0) as start, patch.object(sys, 'argv', ['panel.py', self.db]):
            self.assertEqual(panel.main(),0)
        self.assertIsNone(start.call_args.args[-1], '不带参数必须传未知，不能猜安装范围')

    def test_cli_scope_and_state(self):
        import panel
        with patch.object(sys, 'argv', ['panel.py', self.db, '--功能声明', self.panel, '--只补功能']):
            self.assertEqual(panel.main(), 0)
        scope = self.sync([self.panel])
        state = ai._安装范围状态(ai.读配置(self.db), scope, self.db)
        self.assertFalse(state['已调用'])
        self.assertFalse(state['供应商就绪'])
        with sqlite3.connect(self.db) as c:
            c.execute("INSERT INTO 日志(功能,成没成) VALUES('未装 · 旧记录',1)")
        self.assertFalse(ai._安装范围状态(ai.读配置(self.db), scope, self.db)['已调用'])
        ai.加备选('笔记 · 打标签', 'DeepSeek', 'backup', 库=self.db)
        backup = next(f['功能名'] for f in ai.读配置(self.db)['功能'] if f['父功能']=='笔记 · 打标签')
        with sqlite3.connect(self.db) as c:
            c.execute('INSERT INTO 日志(功能,成没成) VALUES(?,0)', (backup,))
            c.executemany("INSERT INTO 日志(功能,成没成) VALUES('未装 · 旧记录',1)", [()]*501)
        self.assertTrue(ai._安装范围状态(ai.读配置(self.db), scope, self.db)['已调用'])
        ai.设密钥('DeepSeek', 'fake', 库=self.db)
        self.assertTrue(ai._安装范围状态(ai.读配置(self.db), scope, self.db)['供应商就绪'])


def run_core(module):
    global ai
    ai = module
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(InstalledFeatures))
    assert result.wasSuccessful(), '安装声明自检失败'


def run_panel():
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(PanelInstalled))
    assert result.wasSuccessful(), '面板安装声明自检失败'


if __name__ == '__main__':
    unittest.main()

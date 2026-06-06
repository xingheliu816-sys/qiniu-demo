"""测试链接导入的编码检测逻辑。

模拟不同编码（UTF-8 / GBK / GB2312）的 HTML 字节流，验证后端能够正确识别并解码。
不实际发起 HTTP 请求 — 直接验证字节解析路径。
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def _decode_like_backend(raw_bytes, content_type=''):
    """复现 app.api_import_link 的编码探测逻辑，方便单元测试。"""
    import re
    encoding = None
    m = re.search(r'charset=([\w\-]+)', content_type, re.IGNORECASE)
    if m:
        encoding = m.group(1).strip()
    if not encoding:
        head_text = raw_bytes[:4096].decode('ascii', errors='replace')
        m = re.search(r'<meta[^>]+charset\s*=\s*["\']?([\w\-]+)', head_text, re.IGNORECASE)
        if m:
            encoding = m.group(1).strip()
    if encoding:
        enc_lower = encoding.lower()
        if enc_lower in ('gb2312', 'gbk'):
            encoding = 'gb18030'
        else:
            encoding = enc_lower
    if not encoding:
        try:
            raw_bytes.decode('utf-8')
            encoding = 'utf-8'
        except UnicodeDecodeError:
            encoding = 'gb18030'
    try:
        return raw_bytes.decode(encoding, errors='replace'), encoding
    except (LookupError, UnicodeDecodeError):
        return raw_bytes.decode('utf-8', errors='replace'), 'utf-8'


class TestLinkImportEncoding(unittest.TestCase):

    REPLACEMENT_CHAR = '�'

    def test_utf8_with_meta_charset(self):
        html = '<html><head><meta charset="UTF-8"><title>剑来</title></head><body>陈平安</body></html>'
        raw = html.encode('utf-8')
        text, enc = _decode_like_backend(raw)
        self.assertEqual(enc, 'utf-8')
        self.assertIn('剑来', text)
        self.assertIn('陈平安', text)
        self.assertNotIn(self.REPLACEMENT_CHAR, text)

    def test_gbk_with_http_content_type(self):
        # 模拟笔趣阁等中文站点：响应头声明 gbk，body 也是 gbk 字节
        html = '<html><head><title>剑来 - 烽火戏诸侯</title></head><body>第一章 惊蛰，陈平安端着木碗。</body></html>'
        raw = html.encode('gb18030')
        text, enc = _decode_like_backend(raw, content_type='text/html; charset=gbk')
        # gbk 应归一为 gb18030
        self.assertEqual(enc, 'gb18030')
        self.assertIn('剑来', text)
        self.assertIn('烽火戏诸侯', text)
        self.assertIn('陈平安', text)
        self.assertNotIn(self.REPLACEMENT_CHAR, text)

    def test_gbk_with_meta_charset_only(self):
        # 一些老站点 Content-Type 没声明 charset，只在 <meta> 里写
        html = (
            '<html><head>'
            '<meta http-equiv="Content-Type" content="text/html; charset=gbk" />'
            '<title>测试小说</title></head>'
            '<body>第一章 序幕</body></html>'
        )
        raw = html.encode('gb18030')
        text, enc = _decode_like_backend(raw)
        self.assertEqual(enc, 'gb18030')
        self.assertIn('测试小说', text)
        self.assertIn('第一章 序幕', text)
        self.assertNotIn(self.REPLACEMENT_CHAR, text)

    def test_gb2312_aliased_to_gb18030(self):
        # 很多旧 gb2312 页面其实包含 gbk/gb18030 特有字符，所以 gb2312 必须升到 gb18030
        html = '<html><head><meta charset="gb2312"><title>测试</title></head><body>內容</body></html>'
        raw = html.encode('gb18030')
        text, enc = _decode_like_backend(raw)
        self.assertEqual(enc, 'gb18030')
        self.assertIn('测试', text)
        self.assertNotIn(self.REPLACEMENT_CHAR, text)

    def test_utf8_without_explicit_charset_is_detected(self):
        # 没有任何 charset 声明 — 应启发式回退到 utf-8
        html = '<html><body>纯文本中文内容</body></html>'
        raw = html.encode('utf-8')
        text, enc = _decode_like_backend(raw)
        self.assertEqual(enc, 'utf-8')
        self.assertIn('纯文本中文内容', text)
        self.assertNotIn(self.REPLACEMENT_CHAR, text)

    def test_gbk_without_explicit_charset_falls_back(self):
        # GBK 字节 + 无 charset 声明 → utf-8 解码会失败，回退 gb18030
        html = '第一章 惊蛰，陈平安端着木碗。' * 3
        raw = html.encode('gb18030')
        text, enc = _decode_like_backend(raw)
        # 应该回退到 gb18030 并正确解出
        self.assertEqual(enc, 'gb18030')
        self.assertIn('第一章', text)
        self.assertIn('陈平安', text)
        self.assertNotIn(self.REPLACEMENT_CHAR, text)

    def test_buggy_old_behavior_produces_replacement_chars(self):
        # 反向验证旧实现的 bug：硬编码 utf-8 解码 gbk 字节会产生 �
        raw = '剑来'.encode('gb18030')
        bad = raw.decode('utf-8', errors='replace')
        self.assertIn(self.REPLACEMENT_CHAR, bad)


if __name__ == '__main__':
    unittest.main()

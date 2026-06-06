"""测试链接导入的 HTML 清洗 / chrome 过滤 / VIP 检测。

直接调用 src.html_cleaner 的纯函数，不发起 HTTP 请求。
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.html_cleaner import (
    detect_encoding,
    decode_html,
    extract_main_text,
    strip_site_chrome,
    detect_vip_blocked,
    parse_link_response,
)

REPLACEMENT_CHAR = '�'


class TestEncoding(unittest.TestCase):

    def test_utf8_via_content_type(self):
        raw = '<html><body>中文</body></html>'.encode('utf-8')
        self.assertEqual(detect_encoding(raw, 'text/html; charset=UTF-8'), 'utf-8')

    def test_gbk_aliased_to_gb18030(self):
        raw = '<html><body>中文</body></html>'.encode('gb18030')
        self.assertEqual(detect_encoding(raw, 'text/html; charset=gbk'), 'gb18030')
        self.assertEqual(detect_encoding(raw, 'text/html; charset=GB2312'), 'gb18030')

    def test_meta_charset_fallback(self):
        html = '<html><head><meta charset="gbk"></head><body>x</body></html>'
        raw = html.encode('gb18030')
        self.assertEqual(detect_encoding(raw, ''), 'gb18030')

    def test_heuristic_utf8(self):
        raw = '<html><body>纯中文内容</body></html>'.encode('utf-8')
        self.assertEqual(detect_encoding(raw, ''), 'utf-8')

    def test_heuristic_gb18030(self):
        # 故意只用 gb18030 特有字节，让 utf-8 解码失败
        raw = '中文章节'.encode('gb18030')
        # 没有 charset 声明 → utf-8 失败 → 回退 gb18030
        self.assertEqual(detect_encoding(raw, ''), 'gb18030')

    def test_decode_returns_correct_text(self):
        raw = '剑来 - 烽火戏诸侯'.encode('gb18030')
        text, enc = decode_html(raw, 'text/html; charset=gbk')
        self.assertEqual(enc, 'gb18030')
        self.assertIn('剑来', text)
        self.assertNotIn(REPLACEMENT_CHAR, text)


class TestExtractMainText(unittest.TestCase):

    def test_strips_scripts_and_styles(self):
        html = '''<html><body>
            <script>alert(1);</script>
            <style>.a{color:red}</style>
            <div id="content">第一章 序幕<br>陈平安望着窗外。</div>
        </body></html>'''
        text = extract_main_text(html)
        self.assertNotIn('alert', text)
        self.assertNotIn('color:red', text)
        self.assertIn('第一章 序幕', text)
        self.assertIn('陈平安望着窗外', text)

    def test_picks_content_container(self):
        html = '''<html><body>
            <header>站点 logo</header>
            <nav>首页 登录 注册</nav>
            <div id="content">
              第一章 序幕<br>
              真实正文内容。<br>
              这是第二段。
            </div>
            <footer>站点版权</footer>
        </body></html>'''
        text = extract_main_text(html)
        self.assertIn('真实正文内容', text)
        self.assertIn('这是第二段', text)
        # header / nav / footer 的内容被剥掉
        self.assertNotIn('站点 logo', text)
        self.assertNotIn('首页 登录 注册', text)
        self.assertNotIn('站点版权', text)

    def test_br_becomes_newline(self):
        html = '<div class="chapter">第一章<br>第一段<br>第二段</div>'
        text = extract_main_text(html)
        # 不能把段落黏在一起
        self.assertIn('第一章', text)
        self.assertIn('第一段', text)
        self.assertIn('第二段', text)
        # 至少有一个换行
        self.assertTrue('\n' in text)

    def test_html_entities_unescaped(self):
        html = '<div class="content">陈平安&nbsp;&nbsp;望着&amp;思索&#x2014;窗外</div>'
        text = extract_main_text(html)
        self.assertNotIn('&nbsp;', text)
        self.assertNotIn('&amp;', text)
        self.assertNotIn('&#x2014;', text)
        self.assertIn('陈平安', text)
        self.assertIn('窗外', text)

    def test_full_width_space_normalized(self):
        html = '<div class="content">陈平安　望着\xa0窗外</div>'
        text = extract_main_text(html)
        self.assertNotIn('　', text)  # 全角空格
        self.assertNotIn('\xa0', text)


class TestStripSiteChrome(unittest.TestCase):

    def test_removes_navigation_buttons(self):
        text = '\n'.join([
            '第二章 说谎',
            '本章字数：2321字 更新时间：2022-12-04',
            '',
            '正文：陈平安望着窗外。',
            '',
            '上一章',
            '下一章',
            '加书架',
            '目录',
            '夜间',
            '字号',
            '16 20 24 28 32',
            '下载',
            '领红包',
        ])
        cleaned = strip_site_chrome(text)
        for chrome in ('上一章', '下一章', '加书架', '目录', '夜间', '字号',
                       '下载', '领红包', '16 20 24 28 32'):
            self.assertNotIn('\n' + chrome + '\n', '\n' + cleaned + '\n',
                             f'chrome line "{chrome}" should be removed')
        # 章节元信息行也要删
        self.assertNotIn('本章字数', cleaned)
        self.assertNotIn('更新时间', cleaned)
        # 但正文必须保留
        self.assertIn('第二章 说谎', cleaned)
        self.assertIn('正文：陈平安望着窗外', cleaned)

    def test_preserves_normal_paragraphs(self):
        text = '第一章 雨夜来信\n\n陈平安端着木碗坐在屋檐下。\n\n望着对面老槐树。'
        cleaned = strip_site_chrome(text)
        self.assertIn('陈平安端着木碗', cleaned)
        self.assertIn('望着对面老槐树', cleaned)


class TestDetectVipBlocked(unittest.TestCase):

    def test_normal_text_not_flagged(self):
        # 一段正常的小说文字 — 虚词比例正常
        text = (
            '陈平安端着木碗坐在屋檐下，望着对面的老槐树。'
            '他不知道自己在想什么，只是觉得有些累了。'
            '隔壁的小姑娘正在井边打水，她看见了他，笑着挥了挥手。'
            '陈平安也对她笑了笑，他知道这就是他想要的生活。'
        ) * 3
        self.assertFalse(detect_vip_blocked(text))

    def test_vip_blocked_text_is_flagged(self):
        # 复刻用户提供的 VIP 章节样本（虚词大量被吞）
        text = (
            '尖停止，众思绪戛止。'
            '嚣谩骂刻噤。'
            '今违题，怪杀。'
            '足足沉寂钟，羊微微颔首：九，静。'
            '众颜，谁敢，，九。'
            '齐夏伸颤抖，块粉黄脸庞取。'
            '块击碎脑温，微微跳，秒，泄皮球。'
            '请容介绍羊伸血淋淋指，指指具，，羊，参。'
            '众怔，随即，羊，参？'
            '今聚，参游戏，终创造。羊语淡。'
            '连句众纷纷皱眉。'
            '钟，众抵疯，疯创造？'
            '创造健硕紧。'
            '娲羊舞足蹈，散膻腥味，份狰狞，妙啊！'
            '证历史，曾娲创造类，补化彩虹娲，创造娲！'
            '伟务，！'
            '逐渐昂，整似鸡血。'
            '娲健硕眉紧锁，件，顿顿，，某宗吗？'
            '宗？羊微微怔，转，，宗恢弘，！'
        )
        self.assertTrue(detect_vip_blocked(text))

    def test_short_text_not_flagged(self):
        # 文本太短，不参与检测（可能是合法的标题/导航行）
        text = '第二章 说谎'
        self.assertFalse(detect_vip_blocked(text))


class TestParseLinkResponse(unittest.TestCase):

    def test_full_pipeline_with_chrome(self):
        # 一个完整页面，包含 chrome 行和正文
        html = '''<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>第二章 说谎_测试小说_笔趣阁</title>
</head><body>
<header>站点 logo</header>
<nav>首页 登录 注册</nav>
<div id="content">
第二章 说谎<br>
本章字数：2321字 更新时间：2022-12-04<br>
<br>
陈平安端着木碗坐在屋檐下，望着对面的老槐树。<br>
他知道这就是他想要的生活，安静而平淡。<br>
隔壁的小姑娘正在井边打水，她看见了他，笑着挥了挥手。<br>
陈平安也对她笑了笑，他从来不善于表达自己的感情。<br>
</div>
<div class="nav">上一章 下一章 加书架 目录 夜间 字号 16 20 24 28 32 下载 领红包</div>
<footer>站点版权</footer>
</body></html>'''
        ok, payload = parse_link_response(html.encode('utf-8'), 'text/html; charset=utf-8')
        self.assertTrue(ok, msg=payload)
        self.assertIn('第二章 说谎', payload['title'])
        self.assertNotIn('笔趣阁', payload['title'])
        # 正文保留
        self.assertIn('陈平安', payload['text'])
        self.assertIn('木碗', payload['text'])
        # chrome 被剥
        self.assertNotIn('上一章', payload['text'])
        self.assertNotIn('下一章', payload['text'])
        self.assertNotIn('加书架', payload['text'])
        self.assertNotIn('领红包', payload['text'])
        self.assertNotIn('本章字数', payload['text'])
        self.assertNotIn('16 20 24 28 32', payload['text'])
        # 编码记录
        self.assertEqual(payload['encoding'], 'utf-8')

    def test_vip_chapter_is_rejected(self):
        # 模拟一个 VIP 章节页面（虚词被吃）
        vip_text = (
            '尖停止，众思绪戛止。嚣谩骂刻噤。今违题，怪杀。'
            '足足沉寂钟，羊微微颔首：九，静。众颜，谁敢，，九。'
            '齐夏伸颤抖，块粉黄脸庞取。块击碎脑温，微微跳，秒，泄皮球。'
            '请容介绍羊伸血淋淋指，指指具，，羊，参。'
            '今聚，参游戏，终创造。羊语淡。连句众纷纷皱眉。'
            '钟，众抵疯，疯创造？创造健硕紧。'
            '娲羊舞足蹈，散膻腥味，份狰狞。'
            '证历史，曾娲创造类，补化彩虹娲，创造娲！伟务！'
            '逐渐昂，整似鸡血。'
            '娲健硕眉紧锁，件，顿顿，某宗吗？'
            '宗？羊微微怔，转，宗恢弘！'
        )
        html = f'<html><head><meta charset="utf-8"><title>VIP 章节</title></head><body><div id="content">{vip_text}</div></body></html>'
        ok, payload = parse_link_response(html.encode('utf-8'), 'text/html; charset=utf-8')
        self.assertFalse(ok)
        self.assertIn('VIP', payload['message'])
        self.assertIn('文件导入', payload['message'])

    def test_too_short_content_is_rejected(self):
        html = '<html><body><div>无内容</div></body></html>'
        ok, payload = parse_link_response(html.encode('utf-8'))
        self.assertFalse(ok)
        self.assertIn('文件导入', payload['message'])

    def test_gbk_page_with_chinese_chrome(self):
        # 一个 GBK 编码的、模拟笔趣阁布局的页面
        html = '''<html><head>
<meta http-equiv="Content-Type" content="text/html; charset=gbk" />
<title>第一章 雨夜_剑来_笔趣阁</title>
</head><body>
<div id="content">
第一章 雨夜<br>
陈平安端着木碗坐在屋檐下，望着对面的老槐树。<br>
他知道这就是他想要的生活。<br>
隔壁的小姑娘正在井边打水，她看见了他，笑着挥了挥手。
</div>
<div>上一章 下一章 加书架</div>
</body></html>'''
        raw = html.encode('gb18030')
        ok, payload = parse_link_response(raw, 'text/html; charset=gbk')
        self.assertTrue(ok, msg=payload)
        self.assertEqual(payload['encoding'], 'gb18030')
        self.assertIn('剑来', payload['title'])
        self.assertNotIn('笔趣阁', payload['title'])
        self.assertIn('陈平安', payload['text'])
        # 不应该有 �
        self.assertNotIn(REPLACEMENT_CHAR, payload['text'])
        self.assertNotIn(REPLACEMENT_CHAR, payload['title'])


if __name__ == '__main__':
    unittest.main()

import sys
import os
import unittest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.chapter_parser import count_non_blank_chars, parse_chapters, validate_content, build_parse_result


class TestChapterParser(unittest.TestCase):

    def test_count_non_blank_chars(self):
        assert count_non_blank_chars("你好世界") == 4
        assert count_non_blank_chars("Hello World") == 10
        assert count_non_blank_chars("  你好 世界  ") == 4
        assert count_non_blank_chars("第一章 你好 ABC 123") == 11
        assert count_non_blank_chars("") == 0
        assert count_non_blank_chars("  \n  \t  ") == 0

    def test_parse_chinese_chapters(self):
        content = """第一章 雨夜来信
窗外下着大雨。
他站在窗前，看着雨水顺着玻璃滑落。

第二章 旧宅疑云
推开那扇沉重的木门，一股霉味扑面而来。

第三章 神秘电话
电话铃响起的时候，他正在整理行李。"""
        chapters = parse_chapters(content)
        assert len(chapters) == 3
        assert chapters[0]['title'] == '第一章 雨夜来信'
        assert chapters[1]['title'] == '第二章 旧宅疑云'
        assert chapters[2]['title'] == '第三章 神秘电话'
        assert chapters[0]['wordCount'] > 0
        assert chapters[1]['wordCount'] > 0
        assert chapters[2]['wordCount'] > 0

    def test_parse_numeric_chapters(self):
        content = """第1章 开始
这是第一章的内容。

第2章 发展
这是第二章的内容。

第3章 结局
这是第三章的内容。"""
        chapters = parse_chapters(content)
        assert len(chapters) == 3
        assert chapters[0]['title'] == '第1章 开始'
        assert chapters[1]['title'] == '第2章 发展'
        assert chapters[2]['title'] == '第3章 结局'

    def test_parse_chapter_with_zero_padding(self):
        content = """第001章 第一章
第一段内容。

第002章 第二章
第二段内容。"""
        chapters = parse_chapters(content)
        assert len(chapters) == 2
        assert chapters[0]['title'] == '第001章 第一章'

    def test_parse_chapter_english(self):
        content = """Chapter 1 The Beginning
This is the first chapter.

Chapter 2 The Middle
This is the second chapter."""
        chapters = parse_chapters(content)
        assert len(chapters) == 2
        assert chapters[0]['title'] == 'Chapter 1 The Beginning'
        assert chapters[1]['title'] == 'Chapter 2 The Middle'

    def test_parse_prologue_and_epilogue(self):
        content = """序章
这是序章的内容，交代故事背景。

第一章 正式开场
故事正式开始。

番外
这是一个番外故事。"""
        chapters = parse_chapters(content)
        assert len(chapters) >= 2
        assert chapters[0]['title'] == '序章'

    def test_parse_no_title_at_beginning(self):
        content = """在故事的开头，有一段引子。
这段内容在第一个正式章节标题之前。

第一章 正式章节
这是正式章节的内容。"""
        chapters = parse_chapters(content)
        assert len(chapters) == 2
        assert chapters[0]['title'] == '未命名章节 1'
        assert chapters[1]['title'] == '第一章 正式章节'

    def test_parse_no_chapters_at_all(self):
        content = """这是一篇没有章节标题的小说。
全文只有一段连续的文本。
没有分章，没有标题。"""
        chapters = parse_chapters(content)
        assert len(chapters) == 1
        assert chapters[0]['title'] == '未命名章节 1'

    def test_parse_empty_and_whitespace_handling(self):
        content = """


第一章  你好  

这是正文。



第二章  再见  

这是第二章正文。


"""
        chapters = parse_chapters(content)
        assert len(chapters) == 2
        assert chapters[0]['title'] == '第一章  你好'
        assert chapters[1]['title'] == '第二章  再见'

    def test_validate_content_empty(self):
        valid, msg = validate_content("")
        assert not valid
        assert "不能为空" in msg

    def test_validate_content_too_short(self):
        valid, msg = validate_content("你好" * 30)
        assert not valid
        assert "100 字" in msg

    def test_validate_content_ok(self):
        text = "你好世界。" * 30
        valid, msg = validate_content(text)
        assert valid
        assert msg == ""

    def test_build_parse_result_fail_too_short(self):
        result = build_parse_result("测试", "你好", "paste")
        assert not result['success']
        assert result['chapterCount'] == 0

    def test_build_parse_result_success(self):
        content = """第一章 开始
这是第一章的内容，需要足够长才能通过验证。
我们继续补充内容让字数达到一百字以上。
再写一些句子来确保总字数达标。
好了现在字数应该足够了。

第二章 发展
这是第二章的内容，也需要足够的字数。
再来一些文字填充以确保每章都有内容。

第三章 结局
这是第三章的内容，结局部分同样需要字数。
最后的补充内容。"""
        result = build_parse_result("测试小说", content, "paste")
        assert result['success']
        assert result['chapterCount'] >= 3
        assert result['isEnoughChapters']
        assert '识别成功' in result['message']

    def test_build_parse_result_less_than_3(self):
        content = """第一章 开始
这是第一章的内容，需要足够长才能通过验证。
我们继续补充内容让字数达到一百字以上。
再写一些句子来确保总字数达标。
好了现在字数应该足够了。
继续补充一些文字，让总字数妥妥超过一百字的要求。
这样验证就能通过了，测试就可以顺利运行。"""
        result = build_parse_result("测试小说", content, "paste")
        assert result['success']
        assert result['chapterCount'] < 3
        assert not result['isEnoughChapters']
        assert '仅识别到' in result['message']

    def test_build_parse_result_default_title(self):
        content = """第一章 开始
这是第一章的内容，需要足够长才能通过验证。
我们继续补充内容让字数达到一百字以上。
再写一些句子来确保总字数达标。
好了现在字数应该足够了。
继续补充一些文字，让总字数妥妥超过一百字的要求。
这样验证就能通过了，测试就可以顺利运行。"""
        result = build_parse_result("", content, "paste")
        assert result['title'] == '未命名小说'

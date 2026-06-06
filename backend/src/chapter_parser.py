import re


def count_non_blank_chars(text):
    return len(re.sub(r'\s', '', text))


def validate_chapter_content(content):
    if not content or not content.strip():
        return False, "章节正文不能为空。"
    word_count = count_non_blank_chars(content)
    if word_count < 10:
        return False, f"章节正文至少需要 10 个字。当前字数：{word_count}。"
    return True, ""


def parse_single_chapter(chapter_title, chapter_content):
    valid, msg = validate_chapter_content(chapter_content)
    if not valid:
        return {
            "success": False,
            "title": chapter_title or "",
            "wordCount": count_non_blank_chars(chapter_content),
            "message": msg,
        }

    word_count = count_non_blank_chars(chapter_content)
    return {
        "success": True,
        "title": chapter_title or "",
        "content": chapter_content.strip(),
        "wordCount": word_count,
        "message": "当前章节识别成功。",
    }

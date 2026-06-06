import re


def count_non_blank_chars(text):
    return len(re.sub(r'\s', '', text))


def parse_chapters(content):
    if not content or not content.strip():
        return []

    chapter_patterns = [
        r'^第[零一二三四五六七八九十百千万\d]+章\s*.*$',
        r'^第\d+章\s*.*$',
        r'^第\d+节\s*.*$',
        r'^第[零一二三四五六七八九十百千万\d]+节\s*.*$',
        r'^Chapter\s+\d+.*$',
        r'^序章\s*.*$',
        r'^楔子\s*.*$',
        r'^番外\s*.*$',
    ]
    combined_pattern = '|'.join(f'({p})' for p in chapter_patterns)
    compiled = re.compile(combined_pattern, re.IGNORECASE | re.MULTILINE)

    lines = content.split('\n')
    chapter_titles = []
    chapter_start_lines = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and compiled.match(stripped):
            chapter_titles.append(stripped)
            chapter_start_lines.append(i)

    chapters = []

    if not chapter_titles:
        title = "未命名章节 1"
        chapters.append({
            "index": 1,
            "title": title,
            "content": content.strip(),
            "wordCount": count_non_blank_chars(content)
        })
        return chapters

    if chapter_start_lines[0] > 0:
        pre_content_lines = lines[:chapter_start_lines[0]]
        pre_text = '\n'.join(pre_content_lines).strip()
        if pre_text:
            title = "未命名章节 1"
            chapters.append({
                "index": 1,
                "title": title,
                "content": pre_text,
                "wordCount": count_non_blank_chars(pre_text)
            })
            offset = 1
        else:
            offset = 0
    else:
        offset = 0

    for idx, (title_line, start_line) in enumerate(zip(chapter_titles, chapter_start_lines)):
        chapter_index = idx + 1 + offset
        if idx + 1 < len(chapter_start_lines):
            end_line = chapter_start_lines[idx + 1]
        else:
            end_line = len(lines)
        chapter_content_lines = lines[start_line:end_line]
        chapter_text = '\n'.join(chapter_content_lines).strip()
        chapters.append({
            "index": chapter_index,
            "title": title_line,
            "content": chapter_text,
            "wordCount": count_non_blank_chars(chapter_text)
        })

    return chapters


def validate_content(content):
    if not content or not content.strip():
        return False, "小说正文不能为空。"
    word_count = count_non_blank_chars(content)
    if word_count < 100:
        return False, f"小说正文至少需要 100 字，请补充内容后重新识别。当前字数：{word_count}。"
    return True, ""


def build_parse_result(title, content, input_type, chapter_name=None):
    valid, msg = validate_content(content)
    if not valid:
        return {
            "success": False,
            "novelId": None,
            "title": title or "",
            "totalWordCount": count_non_blank_chars(content),
            "chapterCount": 0,
            "isEnoughChapters": False,
            "message": msg,
            "chapters": []
        }

    total_word_count = count_non_blank_chars(content)

    if chapter_name:
        chapters = [{
            "index": 1,
            "title": chapter_name,
            "content": content.strip(),
            "wordCount": total_word_count
        }]
        chapter_count = 1
        is_enough = chapter_count >= 3
        if is_enough:
            message = f"章节识别成功，共识别到 {chapter_count} 个章节。"
        else:
            message = f'当前仅识别到 {chapter_count} 个章节，可能不满足"三个章节以上"的课题要求，请检查章节标题格式。'
    else:
        chapters = parse_chapters(content)
        chapter_count = len(chapters)
        is_enough = chapter_count >= 3
        if chapter_count == 0:
            message = "未识别到任何章节，请检查章节标题格式。"
        elif is_enough:
            message = f"章节识别成功，共识别到 {chapter_count} 个章节。"
        else:
            message = f'当前仅识别到 {chapter_count} 个章节，可能不满足"三个章节以上"的课题要求，请检查章节标题格式。'

    return {
        "success": True,
        "novelId": None,
        "title": title or "",
        "totalWordCount": total_word_count,
        "chapterCount": chapter_count,
        "isEnoughChapters": is_enough,
        "message": message,
        "chapters": chapters
    }

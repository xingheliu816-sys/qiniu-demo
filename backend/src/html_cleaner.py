"""链接导入的 HTML → 纯文本清洗。

把以下三件事独立成函数：
 1. detect_encoding：HTTP Content-Type → <meta charset> → 启发式
 2. extract_main_text：剥脚本样式、找 id/class 含 content 的容器、剥剩余标签
 3. strip_site_chrome：删导航 / 字号 / 下载 / "本章字数" 等站点 chrome 行
 4. detect_vip_blocked：检测常见虚词比例，识别"VIP 章节被吃字"
"""
import html as html_lib
import re


# ---- 编码探测 ----

def detect_encoding(raw_bytes, content_type=''):
    """返回 Python 可识别的编码名（小写）。

    优先级：HTTP Content-Type → <meta charset> → 启发式 UTF-8 / gb18030。
    gb2312 / gbk 一律升到 gb18030（gb2312/gbk 的超集）以兼容扩展字符。
    """
    encoding = None
    m = re.search(r'charset=([\w\-]+)', content_type or '', re.IGNORECASE)
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
            return 'gb18030'
        return enc_lower
    try:
        raw_bytes.decode('utf-8')
        return 'utf-8'
    except UnicodeDecodeError:
        return 'gb18030'


def decode_html(raw_bytes, content_type=''):
    """探测编码 + 解码，返回 (str_text, encoding)。"""
    enc = detect_encoding(raw_bytes, content_type)
    try:
        return raw_bytes.decode(enc, errors='replace'), enc
    except (LookupError, UnicodeDecodeError):
        return raw_bytes.decode('utf-8', errors='replace'), 'utf-8'


# ---- 抽正文 ----

_CONTAINER_PATTERN = re.compile(
    r'<(div|section|article|main)\b[^>]*'
    r'(?:id|class)\s*=\s*["\'][^"\']*'
    r'(content|chapter|read|article|main|text|novel|book|story|bookcontent|chaptercontent|noveltext)'
    r'[^"\']*["\'][^>]*>(.*?)</\1>',
    re.IGNORECASE | re.DOTALL,
)


def extract_main_text(html_text):
    """从完整 HTML 中抽出小说正文纯文本。

    步骤：
      1. 剥 <script>/<style>/<noscript>/注释/header/footer/nav/aside/form
      2. 在 body 内寻找 id/class 含 content/chapter/read/article/main/text/novel/book/story
         的容器，取最长的一个作为正文（最长 = 最可能是真正文）
      3. 块级标签替换为换行，行内标签直接去掉
      4. 反转义 HTML 实体，规范化空白
    """
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html_text, re.IGNORECASE | re.DOTALL)
    body_text = body_match.group(1) if body_match else html_text
    body_text = re.sub(r'<!--.*?-->', '', body_text, flags=re.DOTALL)
    body_text = re.sub(r'<script[^>]*>.*?</script>', '', body_text, flags=re.IGNORECASE | re.DOTALL)
    body_text = re.sub(r'<style[^>]*>.*?</style>', '', body_text, flags=re.IGNORECASE | re.DOTALL)
    body_text = re.sub(r'<noscript[^>]*>.*?</noscript>', '', body_text, flags=re.IGNORECASE | re.DOTALL)
    for tag in ('header', 'footer', 'nav', 'aside', 'form'):
        body_text = re.sub(
            rf'<{tag}\b[^>]*>.*?</{tag}>', '', body_text,
            flags=re.IGNORECASE | re.DOTALL,
        )

    candidates = [m.group(3) for m in _CONTAINER_PATTERN.finditer(body_text)]
    main_html = max(candidates, key=len) if candidates else body_text

    main_html = re.sub(r'<(?:br|/p|/div|/li|/h\d|/tr)\s*/?\s*>', '\n', main_html, flags=re.IGNORECASE)
    text_only = re.sub(r'<[^>]+>', '', main_html)
    text_only = html_lib.unescape(text_only)
    text_only = text_only.replace('\xa0', ' ').replace('　', ' ')
    text_only = re.sub(r'[ \t]+', ' ', text_only)
    text_only = re.sub(r'\n[ \t]+', '\n', text_only)
    text_only = re.sub(r'\n{2,}', '\n\n', text_only).strip()
    return text_only


# ---- 行级 chrome 清洗 ----

_CHROME_EXACT = {
    '上一章', '下一章', '上一页', '下一页', '加书架', '目录', '回目录', '返回目录',
    '夜间', '日间', '夜间模式', '日间模式', '字号', '设置', '下载', '领红包', '推荐',
    '加入书架', '已加入书架', '收藏', '投票', '推荐票', '月票', '打赏', '催更',
    '上一章 下一章', '阅读设置', '章节列表', '加入书签', '书签',
    '繁体', '简体', '复制', '分享', '举报',
}

_CHROME_PREFIX = (
    '本章字数', '本章字数：', '更新时间', '更新时间：', '上传时间', '发布时间',
    '点击数', '阅读数', '收藏数', '推荐数', '字数：', '类别：',
    '上一章：', '下一章：',
)

_CHROME_REGEX = re.compile(
    r'^('
    r'\d{1,3}(\s+\d{1,3}){1,8}'                          # 字号选项："16 20 24 28 32"
    r'|[\d\.]+\s*(M|K|MB|KB)?'                            # 纯数字 / 文件大小
    r'|(上一章|下一章|加书架|目录|夜间|日间|字号|下载|领红包|首页|登录|注册|搜索)\s*'
        r'(/\s*(上一章|下一章|加书架|目录|夜间|日间|字号|下载|领红包|首页|登录|注册|搜索)\s*)*'
    r')$'
)


def strip_site_chrome(text):
    """删除站点导航 / 设置 / 章节元信息等 chrome 行。

    保留空行用于段落分隔。
    """
    filtered = []
    for raw in text.split('\n'):
        line = raw.strip()
        if not line:
            filtered.append('')
            continue
        if line in _CHROME_EXACT:
            continue
        if any(line.startswith(p) for p in _CHROME_PREFIX):
            continue
        if _CHROME_REGEX.match(line):
            continue
        filtered.append(line)
    cleaned = '\n'.join(filtered)
    return re.sub(r'\n{2,}', '\n\n', cleaned).strip()


# ---- VIP / 防爬章节检测 ----

_STOP_CHARS = set('的了是在不这那他她就有说和与人我你也都要')
_CN_RE = re.compile(r'[一-鿿]')


def detect_vip_blocked(text, min_chars=120, threshold=0.015):
    """启发式判断文本是否为 VIP 章节被吃过字。

    任何正常的中文段落里「的、了、是、在、不、这、那、他、她、就、有、说、和、与、
    人、我、你、也、都、要」这些虚词加起来都会占 5~15%。
    如果中文长度 ≥ min_chars 而虚词比例 < threshold (默认 1.5%)，几乎可以确定是
    站点把虚词隐藏掉做反爬的 VIP 章节。

    阈值取值依据：正常中文文本的虚词比例典型在 8% 以上，连篇古文也很难低于 3%；
    1.5% 给一档非常宽松的安全边界，避免误伤诗词 / 古文 / 短对话密集的章节。

    返回 True 表示「应当拒绝导入」。
    """
    cn_chars = _CN_RE.findall(text)
    if len(cn_chars) < min_chars:
        return False
    stop_count = sum(1 for c in cn_chars if c in _STOP_CHARS)
    return stop_count / len(cn_chars) < threshold


# ---- 整合：从原始 HTML 字节得到可入库的小说正文（或拒绝原因） ----

def parse_link_response(raw_bytes, content_type=''):
    """高层入口：返回 (success, payload)。

    payload 在 success=True 时为 {"title": str, "text": str, "encoding": str}；
    在 success=False 时为 {"message": str}。
    """
    html_text, encoding = decode_html(raw_bytes, content_type)

    # 标题
    title_match = re.search(r'<title[^>]*>(.*?)</title>', html_text, re.IGNORECASE | re.DOTALL)
    title = html_lib.unescape(title_match.group(1)).strip() if title_match else '导入小说'
    title = re.sub(r'\s+', ' ', title).strip()
    title = re.sub(
        r'\s*[_\-|]\s*(笔趣阁|起点|纵横|塔读|全本|最新章节|无弹窗|TXT下载|首发).*$',
        '', title,
    )
    if not title:
        title = '导入小说'

    text = extract_main_text(html_text)
    text = strip_site_chrome(text)

    if len(text) < 50:
        return False, {
            'message': '链接解析失败，可能是该页面不是小说正文，或正文需要登录后才能查看。请改用文件导入。',
        }
    if detect_vip_blocked(text):
        return False, {
            'message': '该页面内容疑似为 VIP / 付费章节，站点已隐藏部分文字，无法正常导入。请改用文件导入。',
        }
    return True, {'title': title, 'text': text, 'encoding': encoding}

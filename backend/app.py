import sys
import os
import traceback
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from flask import Flask, session, request, jsonify
import config
import re

try:
    import config_local as config_override
    for attr in dir(config_override):
        if not attr.startswith('_'):
            setattr(config, attr, getattr(config_override, attr))
except ImportError:
    pass

app = Flask(__name__)
app.secret_key = config.SECRET_KEY


def _strip_user(user_result):
    """清洗 user_result_json，剥离 _chapter_overrides 等内部元数据键。"""
    if isinstance(user_result, dict):
        cleaned = {k: v for k, v in user_result.items() if not k.startswith('_')}
        return cleaned if cleaned else None
    return user_result


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        if 'user_id' not in session:
            return jsonify({"success": False, "message": "未登录"}), 401
        return f(*args, **kwargs)
    return decorated_function


def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS'
    return response


@app.after_request
def after_request(response):
    return add_cors_headers(response)


def log_api_error(e):
    traceback.print_exc()
    print(f"[API Error] {type(e).__name__}: {str(e)}", file=sys.stderr)


@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "message": "接口不存在"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"success": False, "message": "请求方法不允许"}), 405


@app.errorhandler(Exception)
def handle_exception(e):
    log_api_error(e)
    return jsonify({"success": False, "message": "服务器内部错误"}), 500


@app.route('/api/register', methods=['POST', 'OPTIONS'])
def api_register():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({"success": False, "message": "用户名和密码不能为空"})
    if len(password) < 6:
        return jsonify({"success": False, "message": "密码长度至少6位"})
    from src.auth import register_user
    success, message = register_user(username, password)
    return jsonify({"success": success, "message": message})


@app.route('/api/login', methods=['POST', 'OPTIONS'])
def api_login():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({"success": False, "message": "用户名和密码不能为空"})
    from src.auth import login_user
    success, message, user = login_user(username, password)
    if success:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({"success": True, "message": "登录成功", "username": user['username']})
    return jsonify({"success": False, "message": message})


@app.route('/api/logout', methods=['POST', 'OPTIONS'])
def api_logout():
    if request.method == 'OPTIONS':
        return jsonify({})
    session.clear()
    return jsonify({"success": True, "message": "已退出登录"})


@app.route('/api/session', methods=['GET', 'OPTIONS'])
def api_session():
    if request.method == 'OPTIONS':
        return jsonify({})
    if 'user_id' in session:
        return jsonify({"success": True, "username": session.get('username')})
    return jsonify({"success": False, "message": "未登录"}), 401


@app.route('/api/novels', methods=['GET', 'OPTIONS'])
@login_required
def api_novels():
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import get_user_novels
    try:
        novels = get_user_novels(session['user_id'])
        return jsonify({"success": True, "novels": novels})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取小说列表失败"}), 500


@app.route('/api/novels/create', methods=['POST', 'OPTIONS'])
@login_required
def api_create_novel():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json() or {}
    title = data.get('title', '').strip() or ''
    from src.novel_service import create_novel
    try:
        novel_id = create_novel(session['user_id'], title)
        return jsonify({"success": True, "novelId": novel_id, "title": title})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "创建小说项目失败"}), 500


@app.route('/api/novels/<int:novel_id>', methods=['GET', 'OPTIONS'])
@login_required
def api_get_novel(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import get_novel_by_id
    try:
        novel = get_novel_by_id(novel_id, session['user_id'])
        if not novel:
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        return jsonify({"success": True, "novel": novel})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取小说详情失败"}), 500


@app.route('/api/novels/<int:novel_id>/save', methods=['POST', 'OPTIONS'])
@login_required
def api_save_novel(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import save_novel_status, check_novel_ownership
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        save_novel_status(novel_id, session['user_id'], 'imported')
        return jsonify({"success": True, "message": "小说已保存。"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "保存失败"}), 500


@app.route('/api/novels/<int:novel_id>/rename', methods=['POST', 'OPTIONS'])
@login_required
def api_rename_novel(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    new_title = data.get('title', '').strip()
    if not new_title or len(new_title) > 255:
        return jsonify({"success": False, "message": "小说标题不能为空或超过 255 个字符"}), 400
    from src.novel_service import check_novel_ownership
    from src.db import get_db
    from datetime import datetime
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        db = get_db()
        db.table('novels').update({
            'title': new_title,
            'updated_at': datetime.now().isoformat(),
        }).eq('id', novel_id).eq('user_id', session['user_id']).execute()
        return jsonify({"success": True, "message": "小说名称已更新。", "title": new_title})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "更新失败"}), 500


@app.route('/api/novels/<int:novel_id>', methods=['DELETE', 'OPTIONS'])
@login_required
def api_delete_novel(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import delete_novel, check_novel_ownership
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        delete_novel(novel_id, session['user_id'])
        return jsonify({"success": True, "message": "小说已删除。"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "删除失败"}), 500


@app.route('/api/novels/import-file', methods=['POST', 'OPTIONS'])
@login_required
def api_import_file():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    from src.novel_service import create_novel
    from src.db import get_db
    from src.chapter_parser import count_non_blank_chars
    from datetime import datetime
    try:
        file_name = data.get('fileName', '')
        content = data.get('content', '')
        novel_title = file_name.replace('.txt', '').replace('.md', '').strip() or '导入小说'
        user_id = session['user_id']
        novel_id = create_novel(user_id, novel_title)

        lines = content.split('\n')
        chapter_pattern = re.compile(
            r'^(第[零一二三四五六七八九十百千万\d]+章\s*.*|第\d+章\s*.*|Chapter\s+\d+.*|序章\s*.*|楔子\s*.*|番外\s*.*)$',
            re.IGNORECASE
        )
        chapter_titles = []
        chapter_lines = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped and chapter_pattern.match(stripped):
                chapter_titles.append(stripped)
                chapter_lines.append(i)

        db = get_db()
        if not chapter_titles:
            db.table('chapters').insert({
                'novel_id': novel_id, 'user_id': user_id,
                'chapter_index': 1, 'title': '未命名章节',
                'content': content.strip(), 'word_count': count_non_blank_chars(content),
                'parse_status': 'not_parsed',
            }).execute()
            db.table('novels').update({'chapter_count': 1, 'status': 'imported'}).eq('id', novel_id).execute()
        else:
            for idx, (t, start) in enumerate(zip(chapter_titles, chapter_lines)):
                end = chapter_lines[idx + 1] if idx + 1 < len(chapter_lines) else len(lines)
                chapter_text = '\n'.join(lines[start:end]).strip()
                db.table('chapters').insert({
                    'novel_id': novel_id, 'user_id': user_id,
                    'chapter_index': idx + 1, 'title': t,
                    'content': chapter_text, 'word_count': count_non_blank_chars(chapter_text),
                    'parse_status': 'not_parsed',
                }).execute()
            db.table('novels').update({
                'chapter_count': len(chapter_titles), 'status': 'imported'
            }).eq('id', novel_id).execute()

        return jsonify({"success": True, "novelId": novel_id, "title": novel_title})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "导入失败"}), 500


@app.route('/api/novels/import-link', methods=['POST', 'OPTIONS'])
@login_required
def api_import_link():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    url = data.get('url', '').strip()
    if not url:
        return jsonify({"success": False, "message": "请输入链接"}), 400
    import urllib.request
    from src.novel_service import create_novel
    from src.db import get_db
    from src.chapter_parser import count_non_blank_chars
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=15)
        html = response.read().decode('utf-8', errors='replace')

        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
        novel_title = title_match.group(1).strip() if title_match else '导入小说'
        novel_title = re.sub(r'\s+', ' ', novel_title).strip()

        body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.IGNORECASE | re.DOTALL)
        body_text = body_match.group(1) if body_match else html
        text_only = re.sub(r'<[^>]+>', '\n', body_text)
        text_only = re.sub(r'\n\s*\n', '\n', text_only).strip()

        if len(text_only) < 50:
            return jsonify({"success": False, "message": "链接解析失败，请检查链接是否可访问，或改用文件导入。"}), 400

        user_id = session['user_id']
        novel_id = create_novel(user_id, novel_title)

        chapter_pattern = re.compile(
            r'^(第[零一二三四五六七八九十百千万\d]+章\s*.*|第\d+章\s*.*|Chapter\s+\d+.*|序章\s*.*|楔子\s*.*|番外\s*.*)$',
            re.IGNORECASE
        )
        lines = text_only.split('\n')
        chapter_starts = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped and chapter_pattern.match(stripped):
                chapter_starts.append(i)

        db = get_db()
        if chapter_starts:
            for idx, start in enumerate(chapter_starts):
                end = chapter_starts[idx + 1] if idx + 1 < len(chapter_starts) else len(lines)
                chapter_text = '\n'.join(lines[start:end]).strip()
                db.table('chapters').insert({
                    'novel_id': novel_id, 'user_id': user_id,
                    'chapter_index': idx + 1, 'title': lines[start].strip(),
                    'content': chapter_text, 'word_count': count_non_blank_chars(chapter_text),
                    'parse_status': 'not_parsed',
                }).execute()
            db.table('novels').update({
                'chapter_count': len(chapter_starts), 'status': 'imported'
            }).eq('id', novel_id).execute()
        else:
            db.table('chapters').insert({
                'novel_id': novel_id, 'user_id': user_id,
                'chapter_index': 1, 'title': '未命名章节',
                'content': text_only[:10000], 'word_count': count_non_blank_chars(text_only[:10000]),
                'parse_status': 'not_parsed',
            }).execute()
            db.table('novels').update({'chapter_count': 1, 'status': 'imported'}).eq('id', novel_id).execute()

        return jsonify({"success": True, "novelId": novel_id, "title": novel_title})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "链接解析失败，请检查链接是否可访问，或改用文件导入。"}), 500


@app.route('/api/novels/<int:novel_id>/chapters', methods=['GET', 'POST', 'OPTIONS'])
@login_required
def api_novel_chapters(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.db import get_db
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

    if request.method == 'GET':
        try:
            db = get_db()
            result = db.table('chapters').select(
                'id, chapter_index, title, word_count, parse_status, created_at, updated_at'
            ).eq('novel_id', novel_id).eq('user_id', session['user_id']).order('chapter_index').execute()
            chapters = result.data or []

            # 查询每章的提炼状态（从 chapter_extractions 表或 novel_extractions fallback）
            from src.extraction_service import get_chapter_extraction
            for ch in chapters:
                ext = get_chapter_extraction(ch['id'], session['user_id'])
                if ext:
                    ch['hasExtraction'] = True
                    ch['extractionStatus'] = ext.get('status') or 'extracted'
                else:
                    ch['hasExtraction'] = False
                    ch['extractionStatus'] = 'not_extracted'

            return jsonify({"success": True, "chapters": chapters})
        except Exception as e:
            log_api_error(e)
            return jsonify({"success": False, "message": "获取章节列表失败"}), 500

    if request.method == 'POST':
        data = request.get_json() or {}
        try:
            db = get_db()
            count_result = db.table('chapters').select('chapter_index').eq('novel_id', novel_id).eq('user_id', session['user_id']).order('chapter_index', desc=True).limit(1).execute()
            next_index = (count_result.data[0]['chapter_index'] + 1) if count_result.data else 1
            title = data.get('title', '').strip() or f'第 {next_index} 章'
            ins = db.table('chapters').insert({
                'novel_id': novel_id,
                'user_id': session['user_id'],
                'chapter_index': next_index,
                'title': title,
                'content': '',
                'word_count': 0,
                'parse_status': 'not_parsed',
            }).execute()
            chapter = ins.data[0]
            db.table('novels').update({'chapter_count': next_index}).eq('id', novel_id).execute()
            return jsonify({"success": True, "chapter": chapter})
        except Exception as e:
            log_api_error(e)
            return jsonify({"success": False, "message": "创建章节失败"}), 500


@app.route('/api/chapters/<int:chapter_id>', methods=['GET', 'OPTIONS'])
@login_required
def api_get_chapter(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    try:
        db = get_db()
        result = db.table('chapters').select(
            'id, novel_id, chapter_index, title, content, word_count, parse_status'
        ).eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not result.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404
        return jsonify({"success": True, "chapter": result.data[0]})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取章节失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/save', methods=['POST', 'OPTIONS'])
@login_required
def api_save_chapter(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    from src.db import get_db
    from src.chapter_parser import count_non_blank_chars
    try:
        db = get_db()
        existing = db.table('chapters').select('id, novel_id').eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not existing.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404
        title = data.get('title', '').strip()
        content = data.get('content', '')
        word_count = count_non_blank_chars(content)
        update_data = {'word_count': word_count}
        if title:
            update_data['title'] = title
        if content is not None:
            update_data['content'] = content
        from datetime import datetime
        update_data['updated_at'] = datetime.now().isoformat()
        db.table('chapters').update(update_data).eq('id', chapter_id).execute()
        return jsonify({"success": True, "message": "章节已保存。"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "保存失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/rename', methods=['POST', 'OPTIONS'])
@login_required
def api_rename_chapter(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    new_title = data.get('title', '').strip()
    if not new_title or len(new_title) > 255:
        return jsonify({"success": False, "message": "章节标题不能为空或超过 255 个字符"}), 400
    from src.db import get_db
    from datetime import datetime
    try:
        db = get_db()
        existing = db.table('chapters').select('id').eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not existing.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404
        db.table('chapters').update({
            'title': new_title,
            'updated_at': datetime.now().isoformat(),
        }).eq('id', chapter_id).execute()
        return jsonify({"success": True, "message": "章节名称已更新。", "title": new_title})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "更新失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/import-text-preview', methods=['POST', 'OPTIONS'])
@login_required
def api_import_text_preview(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    import re
    try:
        db = get_db()
        owned = db.table('chapters').select('id, novel_id').eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not owned.data:
            return jsonify({"success": False, "message": "无权限导入章节内容。"}), 403

        data = request.get_json()
        if not data or not data.get('text', '').strip():
            return jsonify({"success": False, "message": "章节内容不能为空"}), 400

        text = data['text'].strip()
        lines = text.split('\n')
        chapter_pattern = re.compile(r'^(第[零一二三四五六七八九十百千万\d]+章\s*.*|第\d+章\s*.*|Chapter\s+\d+.*|序章\s*.*|楔子\s*.*|番外\s*.*)$', re.IGNORECASE)
        first_line = lines[0].strip() if lines else ''
        title = first_line
        content = text
        if first_line and chapter_pattern.match(first_line):
            title = first_line
            content = '\n'.join(lines[1:]).strip()
        elif not first_line:
            title = '未命名章节'
        else:
            content = '\n'.join(lines[1:]).strip()
        return jsonify({"success": True, "data": {"title": title, "content": content or text}})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "解析失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/import-file-preview', methods=['POST', 'OPTIONS'])
@login_required
def api_import_file_preview(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    from src.file_text_extractor import extract_text_from_file
    import re
    user_id = session.get('user_id')
    print(
        f"[import-file-preview] user_id={user_id} chapter_id={chapter_id} "
        f"content_type={request.content_type!r} files_keys={list(request.files.keys())} "
        f"form_keys={list(request.form.keys())}",
        file=sys.stderr,
    )
    try:
        db = get_db()
        owned = db.table('chapters').select('id, novel_id').eq('id', chapter_id).eq('user_id', user_id).execute()
        if not owned.data:
            return jsonify({
                "success": False,
                "error": {"code": "FORBIDDEN", "message": "无权限导入该章节内容。"},
                "message": "无权限导入该章节内容。",
            }), 403

        file = request.files.get('file')
        ok, payload = extract_text_from_file(file, user_id=user_id, chapter_id=chapter_id)
        if not ok:
            code = payload.get('code', 'FILE_PARSE_FAILED')
            message = payload.get('message') or '文件解析失败，请检查文件内容或改用文本转换。'
            print(
                f"[import-file-preview] FAILED user_id={user_id} chapter_id={chapter_id} "
                f"code={code} message={message}",
                file=sys.stderr,
            )
            http_status = 400
            if code == 'FORBIDDEN':
                http_status = 403
            return jsonify({
                "success": False,
                "error": {"code": code, "message": message},
                "message": message,
            }), http_status

        text = payload['text']
        lines = text.split('\n')
        chapter_pattern = re.compile(r'^(第[零一二三四五六七八九十百千万\d]+章\s*.*|第\d+章\s*.*|Chapter\s+\d+.*|序章\s*.*|楔子\s*.*|番外\s*.*)$', re.IGNORECASE)
        first_line = lines[0].strip() if lines else ''
        title = first_line
        content = text
        if first_line and chapter_pattern.match(first_line):
            title = first_line
            content = '\n'.join(lines[1:]).strip()
        elif not first_line:
            title = '未命名章节'
        else:
            content = '\n'.join(lines[1:]).strip()
        if not content:
            content = text
        print(
            f"[import-file-preview] OK user_id={user_id} chapter_id={chapter_id} "
            f"title_len={len(title)} content_len={len(content)} encoding={payload.get('encoding')}",
            file=sys.stderr,
        )
        return jsonify({"success": True, "data": {"title": title, "content": content}})
    except Exception as e:
        log_api_error(e)
        return jsonify({
            "success": False,
            "error": {
                "code": "FILE_PARSE_FAILED",
                "message": "文件解析失败，请检查文件内容或改用文本转换。",
            },
            "message": "文件解析失败，请检查文件内容或改用文本转换。",
        }), 500


def _parse_chapters_for_extract(db, chapter_rows):
    """对给定章节执行原识别前置逻辑，并写回 parse_status / word_count / content。

    返回 (success_count, fail_count, error_messages)。
    本函数不抛业务异常；底层调用 supabase 抛出的异常由上层捕获。
    """
    from src.chapter_parser import parse_single_chapter
    from datetime import datetime

    success_count = 0
    fail_count = 0
    errors = []
    for ch in chapter_rows:
        parsed = parse_single_chapter(ch.get('title', ''), ch.get('content', '') or '')
        if parsed['success']:
            db.table('chapters').update({
                'parse_status': 'parsed',
                'word_count': parsed['wordCount'],
                'content': parsed['content'],
                'updated_at': datetime.now().isoformat(),
            }).eq('id', ch['id']).execute()
            success_count += 1
        else:
            db.table('chapters').update({
                'parse_status': 'parse_failed',
                'updated_at': datetime.now().isoformat(),
            }).eq('id', ch['id']).execute()
            fail_count += 1
            errors.append(f"章节 {ch.get('title') or ch['id']}: {parsed['message']}")
    return success_count, fail_count, errors


def _advance_novel_status_after_parse(db, novel_id, user_id):
    """识别前置完成后，把 novels.status 推进到 'parsed'，让提炼页面允许触发。

    只在当前小说存在至少一个已识别章节时才推进。
    """
    from datetime import datetime
    parsed_res = db.table('chapters').select('id', count='exact').eq(
        'novel_id', novel_id
    ).eq('user_id', user_id).eq('parse_status', 'parsed').execute()
    if (parsed_res.count or 0) > 0:
        db.table('novels').update({
            'status': 'parsed',
            'updated_at': datetime.now().isoformat(),
        }).eq('id', novel_id).eq('user_id', user_id).execute()


@app.route('/api/chapters/<int:chapter_id>/parse', methods=['POST', 'OPTIONS'])
@login_required
def api_parse_single_chapter(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    from src.chapter_parser import parse_single_chapter
    from datetime import datetime
    try:
        db = get_db()
        result = db.table('chapters').select(
            'id, novel_id, title, content, word_count, parse_status'
        ).eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not result.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404
        chapter = result.data[0]
        parsed = parse_single_chapter(chapter['title'], chapter['content'])
        if not parsed['success']:
            db.table('chapters').update({
                'parse_status': 'parse_failed',
                'updated_at': datetime.now().isoformat()
            }).eq('id', chapter_id).execute()
            return jsonify({"success": False, "message": parsed['message'], "wordCount": parsed['wordCount']})
        db.table('chapters').update({
            'parse_status': 'parsed',
            'word_count': parsed['wordCount'],
            'content': parsed['content'],
            'updated_at': datetime.now().isoformat()
        }).eq('id', chapter_id).execute()
        return jsonify({
            "success": True,
            "message": "当前章节识别成功。",
            "wordCount": parsed['wordCount'],
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "识别失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/extract', methods=['POST', 'OPTIONS'])
@login_required
def api_extract_single_chapter(chapter_id):
    """单章提炼入口：保存（可选 title/content）→ 识别前置 → 进入小说提炼。

    将原来的"识别成功"中间反馈合并进提炼流程，最终结果是小说级提炼。
    """
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    from src.chapter_parser import count_non_blank_chars
    from src.extraction_service import run_extraction, get_extraction
    from src.novel_service import check_novel_ownership
    from datetime import datetime

    data = request.get_json(silent=True) or {}
    try:
        db = get_db()
        owned = db.table('chapters').select(
            'id, novel_id, title, content'
        ).eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not owned.data:
            return jsonify({"success": False, "message": "无权限操作该章节。"}), 404
        chapter = owned.data[0]
        novel_id = chapter['novel_id']

        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "无权限操作该章节。"}), 404

        update_payload = {}
        if 'title' in data and (data.get('title') or '').strip():
            update_payload['title'] = data['title'].strip()
        if 'content' in data and data.get('content') is not None:
            update_payload['content'] = data['content']
            update_payload['word_count'] = count_non_blank_chars(data['content'])
        if update_payload:
            update_payload['updated_at'] = datetime.now().isoformat()
            try:
                db.table('chapters').update(update_payload).eq('id', chapter_id).execute()
            except Exception as e:
                log_api_error(e)
                return jsonify({"success": False, "message": "章节保存失败，请稍后重试。", "stage": "save"}), 500
            chapter = {**chapter, **update_payload}

        try:
            success_count, _fail_count, errors = _parse_chapters_for_extract(db, [chapter])
        except Exception as e:
            log_api_error(e)
            return jsonify({"success": False, "message": "章节内容处理失败，请检查章节正文后重试。", "stage": "parse"}), 500
        if success_count == 0:
            return jsonify({
                "success": False,
                "message": "章节内容处理失败，请检查章节正文后重试。",
                "stage": "parse",
                "errors": errors,
                "novelId": novel_id,
            }), 400

        _advance_novel_status_after_parse(db, novel_id, session['user_id'])

        success, message, ai_result = run_extraction(novel_id, session['user_id'])
        extraction = get_extraction(novel_id, session['user_id'])
        return jsonify({
            "success": success,
            "message": message if success else "AI 提炼失败，请稍后重试。",
            "stage": "extract" if success else "extract_failed",
            "novelId": novel_id,
            "status": extraction['status'] if extraction else ('extracted' if success else 'failed'),
            "aiResult": ai_result,
            "userResult": _strip_user(extraction.get('user_result_json') if extraction else None),
            "errorMessage": extraction.get('error_message') if extraction else (None if success else message),
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "提炼失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/extract-only', methods=['POST', 'OPTIONS'])
@login_required
def api_extract_single_chapter_only(chapter_id):
    """单章独立 AI 提炼：只对该章节调 AI，结果保存到 chapter_extractions。

    与 /chapters/<id>/extract 不同：本端点不触发整本小说级提炼。
    用于章节查看页"提炼章节/重新提炼"按钮。
    """
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    from src.extraction_service import run_chapter_extraction, get_chapter_extraction
    user_id = session['user_id']
    try:
        db = get_db()
        chapter = db.table('chapters').select(
            'id, novel_id, title'
        ).eq('id', chapter_id).eq('user_id', user_id).execute()
        if not chapter.data:
            return jsonify({"success": False, "message": "无权限操作该章节提炼内容。"}), 403

        novel_id = chapter.data[0]['novel_id']
        success, message, extraction_json = run_chapter_extraction(novel_id, user_id, chapter_id)
        if not success:
            return jsonify({
                "success": False,
                "message": message or "章节提炼失败，请稍后重试。",
                "status": "failed",
            }), 200

        # 重新读最新保存结果（user_result_json 优先）
        saved = get_chapter_extraction(chapter_id, user_id)
        return jsonify({
            "success": True,
            "message": "章节提炼完成",
            "status": "extracted",
            "extraction": (saved.get("extraction_json") if saved else extraction_json),
            "source": "chapter_ai_extraction",
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "章节提炼失败"}), 500


@app.route('/api/novels/<int:novel_id>/chapters/batch-parse', methods=['POST', 'OPTIONS'])
@login_required
def api_batch_parse_chapters(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data or 'chapterIds' not in data or not data['chapterIds']:
        return jsonify({"success": False, "message": "请选择要识别的章节"}), 400
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
    from src.db import get_db
    from src.chapter_parser import parse_single_chapter
    from datetime import datetime
    chapter_ids = data['chapterIds']
    try:
        db = get_db()
        chapters_result = db.table('chapters').select(
            'id, title, content, word_count'
        ).eq('novel_id', novel_id).eq('user_id', session['user_id']).in_('id', chapter_ids).execute()
        if not chapters_result.data:
            return jsonify({"success": False, "message": "未找到对应章节"}), 404
        success_count = 0
        fail_count = 0
        errors = []
        for ch in chapters_result.data:
            parsed = parse_single_chapter(ch['title'], ch['content'])
            if parsed['success']:
                db.table('chapters').update({
                    'parse_status': 'parsed',
                    'word_count': parsed['wordCount'],
                    'content': parsed['content'],
                    'updated_at': datetime.now().isoformat()
                }).eq('id', ch['id']).execute()
                success_count += 1
            else:
                db.table('chapters').update({
                    'parse_status': 'parse_failed',
                    'updated_at': datetime.now().isoformat()
                }).eq('id', ch['id']).execute()
                fail_count += 1
                errors.append(f"章节 {ch['title']}: {parsed['message']}")
        msg = f"已完成所选章节识别。本次识别章节数：{success_count}"
        if fail_count > 0:
            msg += f"，失败：{fail_count}"
        return jsonify({"success": True, "message": msg, "errors": errors})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "批量识别失败"}), 500


@app.route('/api/novels/<int:novel_id>/chapters/extract', methods=['POST', 'OPTIONS'])
@login_required
def api_batch_extract_chapters(novel_id):
    """多章提炼入口：逐章独立 AI 提炼，结果保存到章节级提炼。

    请求体：{ "chapterIds": [..] }
    每个选中的章节独立调 AI，结果保存到 chapter_extractions。
    不触发整本小说提炼。
    """
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.db import get_db
    from src.extraction_service import run_chapter_extraction, get_chapter_extraction

    data = request.get_json(silent=True) or {}
    chapter_ids = data.get('chapterIds') or []
    if not chapter_ids:
        return jsonify({"success": False, "message": "请先选择需要提炼的章节。"}), 400

    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "无权限操作该章节。"}), 404

    user_id = session['user_id']
    try:
        db = get_db()
        chapters_result = db.table('chapters').select(
            'id, title, content, word_count'
        ).eq('novel_id', novel_id).eq('user_id', user_id).in_('id', chapter_ids).execute()
        if not chapters_result.data:
            return jsonify({"success": False, "message": "无权限操作该章节。"}), 404
        if len(chapters_result.data) != len(set(chapter_ids)):
            return jsonify({"success": False, "message": "无权限操作该章节。"}), 404

        items = []
        success_count = 0
        failed_count = 0
        for ch in chapters_result.data:
            ch_id = ch['id']
            ok, msg, result = run_chapter_extraction(novel_id, user_id, ch_id)
            item = {"chapterId": ch_id, "chapterTitle": ch.get("title", ""), "success": ok, "message": msg}
            if ok:
                success_count += 1
                saved = get_chapter_extraction(ch_id, user_id)
                item["status"] = "extracted"
                item["extraction"] = saved.get("extraction_json") if saved else result
            else:
                failed_count += 1
                item["status"] = "failed"
            items.append(item)

        return jsonify({
            "success": True,
            "message": f"提炼完成：{success_count} 章成功" + (f"，{failed_count} 章失败。" if failed_count else "。"),
            "total": len(chapters_result.data),
            "successCount": success_count,
            "failedCount": failed_count,
            "items": items,
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "提炼失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/delete', methods=['POST', 'OPTIONS'])
@login_required
def api_delete_chapter(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    try:
        db = get_db()
        existing = db.table('chapters').select('id, novel_id').eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not existing.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404
        novel_id = existing.data[0]['novel_id']
        db.table('chapters').delete().eq('id', chapter_id).execute()
        remaining = db.table('chapters').select('id').eq('novel_id', novel_id).execute()
        db.table('novels').update({'chapter_count': len(remaining.data or [])}).eq('id', novel_id).execute()
        return jsonify({"success": True, "message": "章节已删除。"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "删除失败"}), 500


@app.route('/api/novels/<int:novel_id>/chapters/delete', methods=['POST', 'OPTIONS'])
@login_required
def api_batch_delete_chapters(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data or 'chapterIds' not in data or not data['chapterIds']:
        return jsonify({"success": False, "message": "请选择要删除的章节"}), 400
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
    from src.db import get_db
    chapter_ids = data['chapterIds']
    try:
        db = get_db()
        existing = db.table('chapters').select('id').eq('novel_id', novel_id).eq('user_id', session['user_id']).in_('id', chapter_ids).execute()
        if not existing.data:
            return jsonify({"success": False, "message": "未找到对应章节"}), 404
        valid_ids = [c['id'] for c in existing.data]
        db.table('chapters').delete().in_('id', valid_ids).execute()
        remaining = db.table('chapters').select('id').eq('novel_id', novel_id).execute()
        db.table('novels').update({'chapter_count': len(remaining.data or [])}).eq('id', novel_id).execute()
        return jsonify({"success": True, "message": f"已删除 {len(valid_ids)} 个章节。"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "批量删除失败"}), 500


@app.route('/api/history', methods=['GET', 'OPTIONS'])
@login_required
def api_history():
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.record_service import get_user_novels_with_records
    try:
        records = get_user_novels_with_records(session['user_id'])
        return jsonify({"success": True, "records": records})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取记录失败"}), 500


@app.route('/api/novels/<int:novel_id>/extract', methods=['POST', 'OPTIONS'])
@login_required
def api_extract_novel(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.extraction_service import run_extraction, get_extraction
    from src.db import get_db
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

        db = get_db()
        parsed_count_res = db.table('chapters').select('id', count='exact').eq(
            'novel_id', novel_id
        ).eq('user_id', session['user_id']).eq('parse_status', 'parsed').execute()
        if (parsed_count_res.count or 0) == 0:
            all_chapters = db.table('chapters').select(
                'id, title, content, word_count'
            ).eq('novel_id', novel_id).eq('user_id', session['user_id']).order('chapter_index').execute()
            if all_chapters.data:
                try:
                    _parse_chapters_for_extract(db, all_chapters.data)
                except Exception as e:
                    log_api_error(e)
                    return jsonify({"success": False, "message": "章节内容处理失败，请检查章节正文后重试。", "stage": "parse"}), 500
                _advance_novel_status_after_parse(db, novel_id, session['user_id'])

        success, message, ai_result = run_extraction(novel_id, session['user_id'])
        extraction = get_extraction(novel_id, session['user_id'])
        return jsonify({
            "success": success,
            "message": message if success else "AI 提炼失败，请稍后重试。",
            "status": extraction['status'] if extraction else ('extracted' if success else 'failed'),
            "aiResult": ai_result,
            "userResult": _strip_user(extraction.get('user_result_json') if extraction else None),
            "errorMessage": extraction.get('error_message') if extraction else (None if success else message),
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "小说提炼失败"}), 500


@app.route('/api/novels/<int:novel_id>/extraction', methods=['GET', 'OPTIONS'])
@login_required
def api_get_extraction(novel_id):
    """只读：获取小说整体提炼 + 章节提炼概要。绝不调用 AI。"""
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.extraction_service import get_extraction, get_chapter_extraction
    from src.db import get_db
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        extraction = get_extraction(novel_id, session['user_id'])

        # 读取所有章节提炼状态（表不存在时从 AI 结果兜底）
        chapter_extractions_status = []
        try:
            db = get_db()
            chapters = db.table('chapters').select(
                'id, chapter_index, title'
            ).eq('novel_id', novel_id).eq('user_id', session['user_id']).order('chapter_index').execute()
            for ch in (chapters.data or []):
                ch_ext = get_chapter_extraction(ch['id'], session['user_id'])
                if ch_ext:
                    chapter_extractions_status.append({
                        "chapterId": ch['id'],
                        "chapterIndex": ch.get('chapter_index'),
                        "chapterTitle": ch.get('title', ''),
                        "status": ch_ext.get("status") or "extracted",
                        "extraction": ch_ext.get("extraction_json"),
                    })
                else:
                    # 表不存在或该章节无独立记录 → 标记为有数据则 derived
                    chapter_extractions_status.append({
                        "chapterId": ch['id'],
                        "chapterIndex": ch.get('chapter_index'),
                        "chapterTitle": ch.get('title', ''),
                        "status": "not_extracted",
                        "extraction": None,
                    })
        except Exception:
            pass

        if not extraction:
            return jsonify({
                "success": True,
                "status": "not_started",
                "aiResult": None,
                "userResult": None,
                "errorMessage": None,
                "chapterExtractions": chapter_extractions_status,
            })
        return jsonify({
            "success": True,
            "status": extraction['status'],
            "aiResult": extraction.get('ai_result_json'),
            "userResult": _strip_user(extraction.get('user_result_json')),
            "errorMessage": extraction.get('error_message'),
            "chapterExtractions": chapter_extractions_status,
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取提炼结果失败"}), 500


@app.route('/api/novels/<int:novel_id>/extractions/all', methods=['GET', 'OPTIONS'])
@login_required
def api_get_all_extractions(novel_id):
    """只读：获取小说整体提炼 + 所有章节提炼。绝不调用 AI。"""
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.extraction_service import get_extraction, get_chapter_extraction
    from src.db import get_db
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "无权限查看该提炼内容。"}), 403

        novel_ext = get_extraction(novel_id, session['user_id'])
        novel_extraction = None
        if novel_ext:
            novel_extraction = {
                "status": novel_ext.get("status"),
                "aiResult": novel_ext.get("ai_result_json"),
                "userResult": _strip_user(novel_ext.get("user_result_json")),
                "errorMessage": novel_ext.get("error_message"),
            }

        db = get_db()
        chapters = db.table('chapters').select(
            'id, chapter_index, title'
        ).eq('novel_id', novel_id).eq('user_id', session['user_id']).order('chapter_index').execute()

        chapter_extractions_list = []
        for ch in (chapters.data or []):
            ch_ext = get_chapter_extraction(ch['id'], session['user_id'])
            item = {
                "chapterId": ch['id'],
                "chapterIndex": ch.get('chapter_index'),
                "chapterTitle": ch.get('title', ''),
                "status": "not_extracted",
                "extraction": None,
            }
            if ch_ext:
                item["status"] = ch_ext.get("status") or "extracted"
                item["extraction"] = ch_ext.get("extraction_json")
            chapter_extractions_list.append(item)

        return jsonify({
            "success": True,
            "data": {
                "novelExtraction": novel_extraction,
                "chapterExtractions": chapter_extractions_list,
            },
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取提炼内容失败"}), 500


@app.route('/api/novels/<int:novel_id>/extraction/save', methods=['POST', 'OPTIONS'])
@login_required
def api_save_extraction(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data or 'userResult' not in data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    user_result = data.get('userResult')
    if not isinstance(user_result, dict):
        return jsonify({"success": False, "message": "userResult 必须是对象"}), 400

    from src.novel_service import check_novel_ownership
    from src.extraction_service import save_user_result
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        save_user_result(novel_id, session['user_id'], user_result)
        return jsonify({"success": True, "message": "提炼结果已保存。", "status": "confirmed"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "保存失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/extraction', methods=['GET', 'OPTIONS'])
@login_required
def api_get_chapter_extraction(chapter_id):
    """只读：获取单个章节的已保存提炼结果。绝不调用 AI。

    优先级：章节级 user_result → 章节级 ai_result → 从小说整体提炼派生 → 无。
    派生成功时自动保存为章节级 ai_result，下次直接读取。
    """
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.db import get_db
    from src.extraction_service import (
        get_chapter_extraction, derive_chapter_extraction_from_novel, save_chapter_extraction,
    )
    try:
        db = get_db()
        chapter_row = db.table('chapters').select(
            'id, novel_id, title, chapter_index'
        ).eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not chapter_row.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404

        chapter = chapter_row.data[0]
        user_id = session['user_id']

        # 1) 章节级已保存结果
        ch_ext = get_chapter_extraction(chapter_id, user_id)
        if ch_ext:
            return jsonify({
                "success": True,
                "status": ch_ext.get("status") or "extracted",
                "extraction": ch_ext.get("extraction_json"),
                "source": "chapter_extraction",
            })

        # 2) 从小说整体提炼派生
        derived, source_desc = derive_chapter_extraction_from_novel(
            chapter['novel_id'], user_id, chapter,
        )
        if derived:
            # 保存为章节级提炼，下次直接读
            save_chapter_extraction(chapter_id, user_id, chapter['novel_id'], derived)
            return jsonify({
                "success": True,
                "status": "extracted",
                "extraction": derived,
                "source": source_desc,
            })

        # 3) 确实没有
        return jsonify({
            "success": True,
            "status": "not_extracted",
            "extraction": None,
            "source": None,
        })
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取章节提炼失败"}), 500


@app.route('/api/chapters/<int:chapter_id>/extraction/save', methods=['POST', 'OPTIONS'])
@login_required
def api_save_chapter_extraction(chapter_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data or 'extractionJson' not in data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    extraction_json = data.get('extractionJson')
    if not isinstance(extraction_json, dict):
        return jsonify({"success": False, "message": "extractionJson 必须是对象"}), 400

    from src.db import get_db
    from src.extraction_service import save_chapter_extraction
    try:
        db = get_db()
        chapter = db.table('chapters').select('id, novel_id').eq('id', chapter_id).eq('user_id', session['user_id']).execute()
        if not chapter.data:
            return jsonify({"success": False, "message": "章节不存在或无权访问"}), 404
        novel_id = chapter.data[0]['novel_id']
        save_chapter_extraction(chapter_id, session['user_id'], novel_id, extraction_json)
        return jsonify({"success": True, "message": "章节提炼结果已保存。"})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "保存失败"}), 500


@app.route('/api/novels/<int:novel_id>/source-ref', methods=['GET', 'OPTIONS'])
@login_required
def api_source_ref(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.extraction_service import get_source_ref
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        try:
            chapter_id = int(request.args.get('chapter_id', '0'))
            start_offset = int(request.args.get('start_offset', '0'))
            end_offset = int(request.args.get('end_offset', '0'))
        except ValueError:
            return jsonify({"success": False, "message": "参数格式错误"}), 400
        ref = get_source_ref(novel_id, session['user_id'], chapter_id, start_offset, end_offset)
        if not ref:
            return jsonify({"success": False, "message": "未找到对应章节"}), 404
        return jsonify({"success": True, **ref})
    except Exception as e:
        log_api_error(e)
        return jsonify({"success": False, "message": "获取原文依据失败"}), 500


# ===== YAML Schema 规则库 =====


@app.route('/api/schemas', methods=['GET', 'OPTIONS'])
@login_required
def api_get_schemas():
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.schema_service import get_schemas
    try:
        result = get_schemas(session['user_id'])
        return jsonify({'success': True, **result})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '获取 Schema 列表失败'}), 500


@app.route('/api/schemas/<int:schema_id>', methods=['GET', 'OPTIONS'])
@login_required
def api_get_schema(schema_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.schema_service import get_schema_detail
    try:
        schema = get_schema_detail(schema_id, session['user_id'])
        if not schema:
            return jsonify({'success': False, 'message': 'Schema 不存在或无权访问'}), 404
        return jsonify({'success': True, 'schema': schema})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '获取 Schema 详情失败'}), 500


@app.route('/api/schemas/create', methods=['POST', 'OPTIONS'])
@login_required
def api_create_schema():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    schema_type = data.get('schemaType', 'custom')
    content_format = data.get('contentFormat', 'yaml')
    content = data.get('content', '')
    if not content:
        return jsonify({'success': False, 'message': 'Schema 内容不能为空'}), 400
    from src.schema_service import create_schema
    try:
        schema_id, err = create_schema(
            session['user_id'], name, description, schema_type, content_format, content
        )
        if err:
            return jsonify({'success': False, 'message': err}), 400
        return jsonify({'success': True, 'schemaId': schema_id})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '创建 Schema 失败'}), 500


@app.route('/api/schemas/<int:schema_id>/update', methods=['POST', 'OPTIONS'])
@login_required
def api_update_schema(schema_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json() or {}
    from src.schema_service import update_schema
    try:
        ok, msg = update_schema(
            schema_id, session['user_id'],
            name=data.get('name'), description=data.get('description'),
            schema_type=data.get('schemaType'), content_format=data.get('contentFormat'),
            content=data.get('content'),
        )
        if not ok:
            if msg == '系统默认 Schema 不支持直接编辑。':
                return jsonify({
                    'success': False,
                    'error': {'code': 'SYSTEM_SCHEMA_READONLY', 'message': '系统默认 Schema 不支持直接编辑。'},
                    'message': '系统默认 Schema 不支持直接编辑。',
                }), 403
            return jsonify({'success': False, 'message': msg}), 400
        return jsonify({'success': True, 'message': 'Schema 已更新。'})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '更新 Schema 失败'}), 500


@app.route('/api/schemas/<int:schema_id>/delete', methods=['POST', 'OPTIONS'])
@login_required
def api_delete_schema(schema_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.schema_service import delete_schema
    try:
        ok, msg = delete_schema(schema_id, session['user_id'])
        if not ok:
            if msg == '系统默认 Schema 不支持删除。':
                return jsonify({
                    'success': False,
                    'error': {'code': 'SYSTEM_SCHEMA_READONLY', 'message': '系统默认 Schema 不支持删除。'},
                    'message': '系统默认 Schema 不支持删除。',
                }), 403
            return jsonify({'success': False, 'message': msg}), 400
        return jsonify({'success': True, 'message': 'Schema 已删除。'})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '删除 Schema 失败'}), 500


@app.route('/api/schemas/<int:schema_id>/copy', methods=['POST', 'OPTIONS'])
@login_required
def api_copy_schema(schema_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.schema_service import copy_schema
    try:
        new_id, err = copy_schema(schema_id, session['user_id'])
        if err:
            return jsonify({'success': False, 'message': err}), 400
        return jsonify({'success': True, 'schemaId': new_id})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '复制 Schema 失败'}), 500


@app.route('/api/schemas/set-default', methods=['POST', 'OPTIONS'])
@login_required
def api_set_default_schema():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json() or {}
    schema_id = data.get('schemaId')
    from src.schema_service import set_default_schema
    try:
        ok, msg = set_default_schema(schema_id, session['user_id'])
        if not ok:
            return jsonify({'success': False, 'message': msg}), 400
        return jsonify({'success': True, 'message': '默认 Schema 已更新。'})
    except Exception as e:
        log_api_error(e)
        return jsonify({'success': False, 'message': '设置默认 Schema 失败'}), 500


# ===== YAML 剧本生成 =====


@app.route('/api/novels/<int:novel_id>/yaml-generate', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_generate(novel_id):
    """生成 YAML 剧本草稿：提炼结果 + Schema → AI → 校验 → 修复 → 保存。"""
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

    data = request.get_json(silent=True) or {}
    schema_id = data.get('schemaId')
    use_schema = data.get('useSchema', True)

    from src.yaml_generation_service import generate_yaml
    success, message, draft = generate_yaml(novel_id, session['user_id'], schema_id, use_schema)
    return jsonify({"success": success, "message": message, "draft": draft})


@app.route('/api/novels/<int:novel_id>/yaml-drafts', methods=['GET', 'OPTIONS'])
@login_required
def api_yaml_drafts_list(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
    from src.yaml_generation_service import get_yaml_drafts
    drafts = get_yaml_drafts(novel_id, session['user_id'])
    return jsonify({"success": True, "drafts": drafts})


@app.route('/api/yaml-drafts/<int:draft_id>', methods=['GET', 'OPTIONS'])
@login_required
def api_yaml_draft_detail(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import get_yaml_draft
    draft = get_yaml_draft(draft_id, session['user_id'])
    if not draft:
        return jsonify({"success": False, "message": "草稿不存在或无权访问"}), 404
    return jsonify({"success": True, "draft": draft})


@app.route('/api/yaml-drafts/<int:draft_id>/save', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_save(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json(silent=True) or {}
    yaml_content = data.get('yamlContent', '')
    from src.yaml_generation_service import save_user_edit
    ok = save_user_edit(draft_id, session['user_id'], yaml_content)
    return jsonify({"success": ok, "message": "已保存。" if ok else "保存失败"})


@app.route('/api/yaml-drafts/<int:draft_id>/validate', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_validate(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import get_yaml_draft
    draft = get_yaml_draft(draft_id, session['user_id'])
    if not draft:
        return jsonify({"success": False, "message": "草稿不存在或无权访问"}), 404
    yaml_text = draft.get('user_edited_content') or draft.get('yaml_content', '')
    schema_content = draft.get('schema_content_snapshot') or ''

    from src.yaml_generation_service import run_comprehensive_validation
    from src.db import get_db
    chapter_ids = []
    try:
        db = get_db()
        chs = db.table('chapters').select('id').eq('novel_id', draft['novel_id']).eq('user_id', session['user_id']).execute()
        chapter_ids = [c['id'] for c in (chs.data or [])]
    except Exception:
        pass

    result = run_comprehensive_validation(yaml_text, schema_content if schema_content else None, chapter_ids)
    return jsonify({"success": True, "data": result})


@app.route('/api/yaml-drafts/<int:draft_id>/confirm', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_confirm(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import confirm_draft
    ok = confirm_draft(draft_id, session['user_id'])
    return jsonify({"success": ok, "message": "已确认。" if ok else "操作失败"})


@app.route('/api/yaml-drafts/<int:draft_id>/delete', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_delete(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import delete_draft
    ok = delete_draft(draft_id, session['user_id'])
    return jsonify({"success": ok, "message": "已删除。" if ok else "操作失败"})


@app.route('/api/yaml-drafts/<int:draft_id>/restore-last-saved', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_restore_last_saved(draft_id):
    """恢复上一次保存版本"""
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import get_yaml_draft
    draft = get_yaml_draft(draft_id, session['user_id'])
    if not draft:
        return jsonify({"success": False, "message": "草稿不存在或无权访问"}), 404
    content = draft.get('user_edited_content') or draft.get('yaml_content') or ''
    return jsonify({"success": True, "content": content})


@app.route('/api/yaml-drafts/<int:draft_id>/restore-ai-original', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_restore_ai_original(draft_id):
    """恢复到 AI 原始生成版本"""
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import get_yaml_draft
    draft = get_yaml_draft(draft_id, session['user_id'])
    if not draft:
        return jsonify({"success": False, "message": "草稿不存在或无权访问"}), 404
    content = draft.get('yaml_content') or ''
    return jsonify({"success": True, "content": content})


@app.route('/api/yaml-drafts/<int:draft_id>/ai-repair', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_ai_repair(draft_id):
    """AI 修复 YAML——JSON-first 流程：让 AI 输出修复后的 JSON 对象，后端再用 yaml.dump 序列化。

    严格只修复结构/字段缺失，不改剧情。修复后新建版本。
    """
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import (
        get_yaml_draft, validate_yaml_syntax, _build_repair_prompt,
        _strip_json_fence, _try_load_json_with_recovery,
        _build_json_schema_from_yaml_schema, _validate_with_jsonschema, _serialize_to_yaml,
    )
    from src.ai_client import call_ai
    from src.db import get_db
    from datetime import datetime
    import yaml as pyyaml

    draft = get_yaml_draft(draft_id, session['user_id'])
    if not draft:
        return jsonify({"success": False, "message": "草稿不存在或无权访问"}), 404

    yaml_text = draft.get('user_edited_content') or draft.get('yaml_content') or ''
    schema_content = draft.get('schema_content_snapshot') or ''

    # 1) 把当前 YAML 解析回 JSON 对象（如果可解析），作为修复输入；不可解析则直接把 YAML 原文交给 AI
    current_obj = None
    parse_err = None
    try:
        loaded = pyyaml.safe_load(yaml_text)
        if isinstance(loaded, dict):
            current_obj = loaded
    except Exception as e:
        parse_err = str(e)

    # 2) 跑一次综合校验，收集错误信息
    valid, syntax_err = validate_yaml_syntax(yaml_text)
    json_schema = _build_json_schema_from_yaml_schema(schema_content) if schema_content else None
    errors_for_prompt = []
    if not valid:
        errors_for_prompt.append(f'YAML 语法错误: {syntax_err}')
    elif current_obj is not None and json_schema:
        ok, errs = _validate_with_jsonschema(current_obj, json_schema)
        if not ok:
            errors_for_prompt.append('JSON Schema 校验错误: ' + '; '.join(errs)[:1500])
    if parse_err and not errors_for_prompt:
        errors_for_prompt.append(f'YAML 无法解析为对象: {parse_err}')
    error_text = '\n'.join(errors_for_prompt) if errors_for_prompt else '请按 Schema 完整补齐字段（结构层面），不改剧情。'

    # 3) 调 AI 输出修复后的 JSON
    repair_input = (
        __import__('json').dumps(current_obj, ensure_ascii=False, indent=2)
        if current_obj is not None else yaml_text
    )
    repair_prompt = _build_repair_prompt(repair_input, error_text, schema_content)

    success, raw_ai_text, _ = call_ai(repair_prompt, timeout=120)
    if not success:
        return jsonify({"success": False, "message": f'AI 修复失败: {raw_ai_text}'}), 200

    # 4) 解析 + 校验 AI 输出
    cleaned = _strip_json_fence(raw_ai_text)
    repaired_obj, json_err = _try_load_json_with_recovery(cleaned)
    if repaired_obj is None:
        return jsonify({"success": False, "message": f'AI 输出 JSON 解析失败: {json_err}'}), 200

    if json_schema:
        ok, schema_errs = _validate_with_jsonschema(repaired_obj, json_schema)
        if not ok:
            # 仍然继续保存，让用户能在编辑器内继续修复
            schema_err_text = '; '.join(schema_errs)[:1500]
        else:
            schema_err_text = None
    else:
        schema_err_text = None

    # 5) 用 yaml.dump 序列化
    try:
        repaired_yaml = _serialize_to_yaml(repaired_obj)
    except Exception as e:
        return jsonify({"success": False, "message": f'JSON → YAML 序列化失败: {e}'}), 200

    # 6) 创建新版本（版本号唯一）
    db = get_db()
    now = datetime.now().isoformat()
    max_ver = db.table('yaml_drafts').select('version').eq('novel_id', draft['novel_id']).eq('user_id', session['user_id']).order('version', desc=True).limit(1).execute()
    new_version = (max_ver.data[0]['version'] + 1) if max_ver.data else 1
    # 防重复：若该版本号已存在则递增
    while db.table('yaml_drafts').select('id').eq('novel_id', draft['novel_id']).eq('user_id', session['user_id']).eq('version', new_version).execute().data:
        new_version += 1

    insert_data = {
        'user_id': session['user_id'],
        'novel_id': draft['novel_id'],
        'version': new_version,
        'version_type': 'ai_repair',
        'schema_id': draft.get('schema_id'),
        'schema_name_snapshot': draft.get('schema_name_snapshot'),
        'schema_content_snapshot': schema_content,
        'schema_format': draft.get('schema_format', 'yaml'),
        'extraction_snapshot_json': draft.get('extraction_snapshot_json'),
        'yaml_content': repaired_yaml,
        'status': 'generated' if not schema_err_text else 'validation_failed',
        'validation_errors': schema_err_text,
        'repair_count': (draft.get('repair_count') or 0) + 1,
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('yaml_drafts').insert(insert_data).execute()
    new_id = result.data[0]['id'] if result.data else None

    return jsonify({"success": True, "draftId": new_id, "version": new_version, "content": repaired_yaml,
                     "message": 'AI 修复完成，已创建新版本'})


@app.route('/api/yaml-drafts/<int:draft_id>/export', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_export(draft_id):
    """导出最终 YAML 剧本文件。前置条件：草稿已确认。"""
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json(silent=True) or {}
    file_format = data.get('format', 'yaml')
    from src.yaml_generation_service import export_final_yaml
    success, message, record = export_final_yaml(draft_id, session['user_id'], file_format)
    if not success:
        return jsonify({"success": False, "message": message}), 400
    return jsonify({"success": True, "message": message, "data": record})


@app.route('/api/yaml-drafts/<int:draft_id>/download-final', methods=['GET', 'OPTIONS'])
@login_required
def api_yaml_draft_download_final(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import get_export_record, get_yaml_draft
    # 优先读导出记录，否则读已确认草稿内容
    record = get_export_record(draft_id, session['user_id'])
    if record:
        content = record.get('yaml_content_snapshot') or ''
        fname = record.get('file_name') or f'novel_{record.get("novel_id")}_final.{record.get("file_format","yaml")}'
    else:
        draft = get_yaml_draft(draft_id, session['user_id'])
        if not draft or draft.get('status') != 'confirmed':
            return jsonify({"success": False, "message": "无权限下载该 YAML 剧本。"}), 403
        content = draft.get('user_edited_content') or draft.get('yaml_content') or ''
        fname = f'novel_{draft["novel_id"]}_final_v{draft["version"]}.yaml'

    from flask import Response
    return Response(content, mimetype='text/yaml; charset=utf-8',
                    headers={'Content-Disposition': f'attachment; filename="{fname}"'})


@app.route('/api/yaml-drafts/<int:draft_id>/download', methods=['GET', 'OPTIONS'])
@login_required
def api_yaml_draft_download(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.yaml_generation_service import get_yaml_draft
    draft = get_yaml_draft(draft_id, session['user_id'])
    if not draft:
        return jsonify({"success": False, "message": "草稿不存在或无权访问"}), 404
    content = draft.get('user_edited_content') or draft.get('yaml_content') or ''
    from flask import Response
    fname = f"novel_{draft['novel_id']}_yaml_draft_v{draft['version']}.yaml"
    return Response(content, mimetype='text/yaml',
                    headers={'Content-Disposition': f'attachment; filename="{fname}"'})


@app.route('/api/yaml-drafts/batch-delete', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_drafts_batch_delete():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json(silent=True) or {}
    draft_ids = data.get('draftIds') or []
    if not draft_ids:
        return jsonify({"success": False, "message": "请选择要删除的版本。"}), 400

    from src.db import get_db
    from datetime import datetime
    user_id = session['user_id']
    db = get_db()
    now = datetime.now().isoformat()

    # 校验所有 draft_ids 都属于当前用户
    existing = db.table('yaml_drafts').select('id').eq('user_id', user_id).in_('id', draft_ids).execute()
    valid_ids = {r['id'] for r in (existing.data or [])}
    if len(valid_ids) != len(set(draft_ids)):
        return jsonify({"success": False, "message": "无权限删除部分 YAML 剧本版本。"}), 403

    deleted_count = 0
    try:
        for did in valid_ids:
            db.table('yaml_drafts').update({
                'status': 'deleted',
                'updated_at': now,
            }).eq('id', did).eq('user_id', user_id).execute()
            deleted_count += 1
    except Exception as e:
        return jsonify({"success": False, "message": f"删除失败: {e}", "deletedCount": deleted_count}), 500

    return jsonify({"success": True, "data": {"deletedCount": deleted_count, "failedCount": 0}})


@app.route('/api/yaml-drafts/<int:draft_id>', methods=['PATCH', 'OPTIONS'])
@login_required
def api_yaml_draft_patch(draft_id):
    """更新 YAML 草稿元数据（如 draft_name）。"""
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json(silent=True) or {}
    draft_name = (data.get('draftName') or '').strip()
    if not draft_name:
        return jsonify({"success": False, "message": "请输入 YAML 文件名称。"}), 400
    if len(draft_name) > 50:
        return jsonify({"success": False, "message": "YAML 文件名称不能超过 50 个字符。"}), 400
    if any(c in draft_name for c in ('/', '\\', '..')):
        return jsonify({"success": False, "message": "名称不能包含路径分隔符。"}), 400

    from src.db import get_db
    from datetime import datetime
    db = get_db()
    existing = db.table('yaml_drafts').select('id').eq('id', draft_id).eq('user_id', session['user_id']).execute()
    if not existing.data:
        return jsonify({"success": False, "message": "无权限操作该 YAML 剧本。"}), 403

    try:
        db.table('yaml_drafts').update({
            'draft_name': draft_name,
            'updated_at': datetime.now().isoformat(),
        }).eq('id', draft_id).eq('user_id', session['user_id']).execute()
    except Exception:
        # draft_name 列可能不存在
        return jsonify({"success": False, "message": "数据库暂不支持修改名称，请先执行 migrate_yaml_draft_name.sql。"}), 500

    return jsonify({"success": True, "data": {"draftName": draft_name}})


@app.route('/api/yaml-drafts/<int:draft_id>/autosave', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_draft_autosave(draft_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json(silent=True) or {}
    yaml_content = data.get('yamlContent', '')
    from src.yaml_generation_service import save_user_edit
    ok = save_user_edit(draft_id, session['user_id'], yaml_content)
    return jsonify({"success": ok, "message": "" if ok else "保存失败"})


@app.route('/api/novels/<int:novel_id>/yaml-regenerate', methods=['POST', 'OPTIONS'])
@login_required
def api_yaml_regenerate(novel_id):
    """重新生成 YAML 剧本——创建新版本，不覆盖旧版。"""
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

    data = request.get_json(silent=True) or {}
    schema_id = data.get('schemaId')
    use_schema = data.get('useSchema', True)

    from src.yaml_generation_service import generate_yaml
    success, message, draft = generate_yaml(novel_id, session['user_id'], schema_id, use_schema)
    return jsonify({"success": success, "message": message, "draft": draft})


# ===== 关系图谱（功能 5） =====


@app.route('/api/novels/<int:novel_id>/relationship-graph', methods=['GET', 'OPTIONS'])
@login_required
def api_relationship_graph_get(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

    from src.relationship_graph_service import get_graph
    record = get_graph(novel_id, session['user_id'])
    if not record:
        return jsonify({"success": True, "graph": None})
    return jsonify({"success": True, "graph": record})


@app.route('/api/novels/<int:novel_id>/relationship-graph/generate', methods=['POST', 'OPTIONS'])
@login_required
def api_relationship_graph_generate(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

    data = request.get_json(silent=True) or {}
    chapter_ids = data.get('chapterIds') or []
    from src.relationship_graph_service import generate_graph
    success, message, record = generate_graph(novel_id, session['user_id'], chapter_ids)
    return jsonify({"success": success, "message": message, "graph": record})


@app.route('/api/novels/<int:novel_id>/relationship-graph/append', methods=['POST', 'OPTIONS'])
@login_required
def api_relationship_graph_append(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404

    data = request.get_json(silent=True) or {}
    chapter_ids = data.get('chapterIds') or []
    from src.relationship_graph_service import append_chapters_to_graph
    success, message, record = append_chapters_to_graph(novel_id, session['user_id'], chapter_ids)
    return jsonify({"success": success, "message": message, "graph": record})


@app.route('/api/novels/<int:novel_id>/relationship-graph', methods=['DELETE'])
@login_required
def api_relationship_graph_delete(novel_id):
    from src.novel_service import check_novel_ownership
    if not check_novel_ownership(novel_id, session['user_id']):
        return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
    from src.relationship_graph_service import delete_graph
    ok = delete_graph(novel_id, session['user_id'])
    return jsonify({"success": ok, "message": "已删除关系图谱" if ok else "删除失败"})


# 启动时初始化系统默认 Schema
with app.app_context():
    try:
        from src.schema_service import init_system_schema
        init_system_schema()
        print('[Init] 系统默认 Schema 检查完成')
    except Exception as e:
        print(f'[Init] 系统默认 Schema 初始化失败: {e}')


if __name__ == '__main__':
    # 启动时 eager import file_text_extractor，确保 Werkzeug reloader 监控该模块文件，
    # 避免因 lazy import 导致 src/file_text_extractor.py 修改后 reloader 不重启。
    from src.file_text_extractor import extract_text_from_file as _eager_eft  # noqa: F401
    print('[Init] 章节文件导入接口已加载: file_text_extractor 已 eager import', file=sys.stderr)
    app.run(host='0.0.0.0', port=5000, debug=True)

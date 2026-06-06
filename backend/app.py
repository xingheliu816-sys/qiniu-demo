import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from flask import Flask, session, request, jsonify
import config

try:
    import config_local as config_override
    for attr in dir(config_override):
        if not attr.startswith('_'):
            setattr(config, attr, getattr(config_override, attr))
except ImportError:
    pass

app = Flask(__name__)
app.secret_key = config.SECRET_KEY


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
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    return response


@app.after_request
def after_request(response):
    return add_cors_headers(response)


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
        return jsonify({"success": False, "message": f"获取小说列表失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"创建小说项目失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"获取小说详情失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"保存失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"删除失败: {str(e)}"}), 500


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
            return jsonify({"success": True, "chapters": result.data or []})
        except Exception as e:
            return jsonify({"success": False, "message": f"获取章节列表失败: {str(e)}"}), 500

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
            # Update novel chapter_count
            db.table('novels').update({'chapter_count': next_index}).eq('id', novel_id).execute()
            return jsonify({"success": True, "chapter": chapter})
        except Exception as e:
            return jsonify({"success": False, "message": f"创建章节失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"获取章节失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"保存失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"识别失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"批量识别失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"获取记录失败: {str(e)}"}), 500


@app.route('/api/novels/<int:novel_id>/extract', methods=['POST', 'OPTIONS'])
@login_required
def api_extract_novel(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.extraction_service import run_extraction, get_extraction
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        success, message, ai_result = run_extraction(novel_id, session['user_id'])
        extraction = get_extraction(novel_id, session['user_id'])
        return jsonify({
            "success": success,
            "message": message,
            "status": extraction['status'] if extraction else ('extracted' if success else 'failed'),
            "aiResult": ai_result,
            "userResult": extraction.get('user_result_json') if extraction else None,
            "errorMessage": extraction.get('error_message') if extraction else (None if success else message),
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"小说提炼失败: {str(e)}"}), 500


@app.route('/api/novels/<int:novel_id>/extraction', methods=['GET', 'OPTIONS'])
@login_required
def api_get_extraction(novel_id):
    if request.method == 'OPTIONS':
        return jsonify({})
    from src.novel_service import check_novel_ownership
    from src.extraction_service import get_extraction
    try:
        if not check_novel_ownership(novel_id, session['user_id']):
            return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
        extraction = get_extraction(novel_id, session['user_id'])
        if not extraction:
            return jsonify({
                "success": True,
                "status": "not_started",
                "aiResult": None,
                "userResult": None,
                "errorMessage": None,
            })
        return jsonify({
            "success": True,
            "status": extraction['status'],
            "aiResult": extraction.get('ai_result_json'),
            "userResult": extraction.get('user_result_json'),
            "errorMessage": extraction.get('error_message'),
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"获取提炼结果失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"保存失败: {str(e)}"}), 500


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
        return jsonify({"success": False, "message": f"获取原文依据失败: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

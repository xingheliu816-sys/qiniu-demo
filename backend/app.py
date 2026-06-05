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
    title = data.get('title', '').strip() or '未命名小说'
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


@app.route('/api/parse-chapters', methods=['POST', 'OPTIONS'])
@login_required
def api_parse_chapters():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400

    title = data.get('title', '').strip()
    content = data.get('content', '')
    input_type = data.get('inputType', 'paste')
    chapter_name = data.get('chapterName', '').strip()
    novel_id = data.get('novelId')

    from src.chapter_parser import build_parse_result
    result = build_parse_result(title, content, input_type, chapter_name)

    if not result['success']:
        return jsonify(result)

    from src.record_service import save_chapters, save_parse_record
    from src.novel_service import update_novel_after_parse
    try:
        user_id = session['user_id']

        if novel_id:
            from src.novel_service import check_novel_ownership
            if not check_novel_ownership(novel_id, user_id):
                return jsonify({"success": False, "message": "小说项目不存在或无权访问"}), 404
            update_novel_after_parse(
                novel_id=novel_id,
                user_id=user_id,
                title=result['title'],
                input_type=input_type,
                original_text=content,
                total_word_count=result['totalWordCount'],
                chapter_count=result['chapterCount'],
                status='parsed' if result['isEnoughChapters'] else 'parse_failed'
            )
            from src.db import get_db
            db = get_db()
            cursor = db.cursor()
            try:
                cursor.execute("DELETE FROM chapters WHERE novel_id = %s", (novel_id,))
                db.commit()
            finally:
                cursor.close()
                db.close()
            result['novelId'] = novel_id
        else:
            from src.record_service import save_novel
            novel_id = save_novel(
                user_id=user_id,
                title=result['title'],
                input_type=input_type,
                original_text=content,
                total_word_count=result['totalWordCount']
            )
            update_novel_after_parse(
                novel_id=novel_id,
                user_id=user_id,
                title=result['title'],
                input_type=input_type,
                original_text=content,
                total_word_count=result['totalWordCount'],
                chapter_count=result['chapterCount'],
                status='parsed' if result['isEnoughChapters'] else 'parse_failed'
            )
            result['novelId'] = novel_id

        save_chapters(novel_id, user_id, result['chapters'])
        save_parse_record(
            novel_id=novel_id,
            user_id=user_id,
            chapter_count=result['chapterCount'],
            is_success=1 if result['isEnoughChapters'] else 0,
            message=result['message']
        )

        for ch in result['chapters']:
            from src.db import get_db
            db = get_db()
            cursor = db.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT id FROM chapters WHERE novel_id = %s AND chapter_index = %s AND user_id = %s",
                    (novel_id, ch['index'], user_id)
                )
                row = cursor.fetchone()
                if row:
                    ch['id'] = row['id']
            finally:
                cursor.close()
                db.close()

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": f"保存记录失败: {str(e)}"}), 500


@app.route('/api/chapters/update-title', methods=['POST', 'OPTIONS'])
@login_required
def api_update_chapter_title():
    if request.method == 'OPTIONS':
        return jsonify({})
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400

    chapter_id = data.get('chapterId')
    title = data.get('title', '').strip()

    if not chapter_id or not title:
        return jsonify({"success": False, "message": "参数不完整"}), 400

    from src.record_service import update_chapter_title
    try:
        success = update_chapter_title(chapter_id, title)
        if success:
            return jsonify({"success": True, "message": "章节标题已保存。"})
        return jsonify({"success": False, "message": "未找到该章节"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": f"保存失败: {str(e)}"}), 500


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

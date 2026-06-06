from src.db import get_db


def save_chapters(novel_id, user_id, chapters):
    db = get_db()
    try:
        rows = []
        for ch in chapters:
            rows.append({
                'novel_id': novel_id,
                'user_id': user_id,
                'chapter_index': ch['index'],
                'title': ch['title'],
                'content': ch['content'],
                'word_count': ch['wordCount']
            })
        db.table('chapters').insert(rows).execute()
    except Exception as e:
        raise e


def save_parse_record(novel_id, user_id, chapter_count, is_success, message):
    db = get_db()
    try:
        result = db.table('chapter_parse_records').insert({
            'novel_id': novel_id,
            'user_id': user_id,
            'chapter_count': chapter_count,
            'is_success': is_success,
            'message': message
        }).execute()
        return result.data[0]['id']
    except Exception as e:
        raise e


def update_chapter_title(chapter_id, title):
    db = get_db()
    try:
        result = db.table('chapters').update({
            'title': title
        }).eq('id', chapter_id).execute()
        return len(result.data) > 0
    except Exception as e:
        raise e


def get_user_novels_with_records(user_id):
    db = get_db()
    try:
        novels_result = db.table('novels').select(
            'id, title, input_type, total_word_count, created_at'
        ).eq('user_id', user_id).order('created_at', desc=True).execute()

        novels = novels_result.data
        for novel in novels:
            record_result = db.table('chapter_parse_records').select(
                'chapter_count, is_success, message'
            ).eq('novel_id', novel['id']).order('created_at', desc=True).limit(1).execute()
            if record_result.data:
                novel['chapter_count'] = record_result.data[0]['chapter_count']
                novel['is_success'] = record_result.data[0]['is_success']
                novel['message'] = record_result.data[0]['message']
            else:
                novel['chapter_count'] = 0
                novel['is_success'] = 0
                novel['message'] = ''
        return novels
    except Exception as e:
        raise e

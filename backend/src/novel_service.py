from src.db import get_db
from datetime import datetime


def _attach_extraction_status(novels):
    if not novels:
        return novels
    db = get_db()
    novel_ids = [n['id'] for n in novels]
    try:
        result = db.table('novel_extractions').select(
            'novel_id, status'
        ).in_('novel_id', novel_ids).execute()
        status_map = {row['novel_id']: row['status'] for row in (result.data or [])}
    except Exception:
        status_map = {}
    for n in novels:
        n['extraction_status'] = status_map.get(n['id'], 'not_started')
    return novels


def get_user_novels(user_id):
    db = get_db()
    try:
        result = db.table('novels').select(
            'id, title, status, total_word_count, chapter_count, created_at, updated_at'
        ).eq('user_id', user_id).order('updated_at', desc=True).order('created_at', desc=True).execute()
        return _attach_extraction_status(result.data)
    except Exception as e:
        raise e


def create_novel(user_id, title):
    db = get_db()
    try:
        now = datetime.now().isoformat()
        result = db.table('novels').insert({
            'user_id': user_id,
            'title': title,
            'original_text': '',
            'status': 'draft',
            'created_at': now,
            'updated_at': now
        }).execute()
        return result.data[0]['id']
    except Exception as e:
        raise e


def get_novel_by_id(novel_id, user_id):
    db = get_db()
    try:
        result = db.table('novels').select(
            'id, user_id, title, input_type, original_text, total_word_count, status, chapter_count, created_at, updated_at'
        ).eq('id', novel_id).eq('user_id', user_id).execute()
        if not result.data:
            return None
        novel = result.data[0]
        _attach_extraction_status([novel])
        return novel
    except Exception as e:
        raise e


def check_novel_ownership(novel_id, user_id):
    novel = get_novel_by_id(novel_id, user_id)
    return novel is not None


def update_novel_after_parse(novel_id, user_id, title, input_type, original_text, total_word_count, chapter_count, status):
    db = get_db()
    try:
        now = datetime.now().isoformat()
        db.table('novels').update({
            'title': title,
            'input_type': input_type,
            'original_text': original_text,
            'total_word_count': total_word_count,
            'chapter_count': chapter_count,
            'status': status,
            'updated_at': now
        }).eq('id', novel_id).eq('user_id', user_id).execute()
    except Exception as e:
        raise e


def save_novel_status(novel_id, user_id, status):
    db = get_db()
    try:
        now = datetime.now().isoformat()
        result = db.table('novels').update({
            'status': status,
            'updated_at': now
        }).eq('id', novel_id).eq('user_id', user_id).execute()
        return len(result.data) > 0
    except Exception as e:
        raise e


def delete_novel(novel_id, user_id):
    db = get_db()
    try:
        db.table('chapter_parse_records').delete().eq('novel_id', novel_id).eq('user_id', user_id).execute()
        db.table('chapters').delete().eq('novel_id', novel_id).eq('user_id', user_id).execute()
        db.table('novels').delete().eq('id', novel_id).eq('user_id', user_id).execute()
        return True
    except Exception as e:
        raise e

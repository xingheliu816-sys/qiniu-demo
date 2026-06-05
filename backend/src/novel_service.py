from src.db import get_db
from datetime import datetime


def get_user_novels(user_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, title, status, total_word_count, chapter_count, created_at, updated_at
            FROM novels
            WHERE user_id = %s
            ORDER BY updated_at DESC, created_at DESC
        """, (user_id,))
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


def create_novel(user_id, title):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        now = datetime.now()
        cursor.execute(
            "INSERT INTO novels (user_id, title, original_text, status, created_at, updated_at) VALUES (%s, %s, '', 'draft', %s, %s)",
            (user_id, title, now, now)
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def get_novel_by_id(novel_id, user_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, user_id, title, input_type, original_text, total_word_count, status, chapter_count, created_at, updated_at FROM novels WHERE id = %s AND user_id = %s",
            (novel_id, user_id)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        db.close()


def check_novel_ownership(novel_id, user_id):
    novel = get_novel_by_id(novel_id, user_id)
    return novel is not None


def update_novel_after_parse(novel_id, user_id, title, input_type, original_text, total_word_count, chapter_count, status):
    db = get_db()
    cursor = db.cursor()
    try:
        now = datetime.now()
        cursor.execute("""
            UPDATE novels
            SET title = %s, input_type = %s, original_text = %s,
                total_word_count = %s, chapter_count = %s,
                status = %s, updated_at = %s
            WHERE id = %s AND user_id = %s
        """, (title, input_type, original_text, total_word_count, chapter_count, status, now, novel_id, user_id))
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def save_novel_status(novel_id, user_id, status):
    db = get_db()
    cursor = db.cursor()
    try:
        now = datetime.now()
        cursor.execute(
            "UPDATE novels SET status = %s, updated_at = %s WHERE id = %s AND user_id = %s",
            (status, now, novel_id, user_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def delete_novel(novel_id, user_id):
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM chapter_parse_records WHERE novel_id = %s AND user_id = %s", (novel_id, user_id))
        cursor.execute("DELETE FROM chapters WHERE novel_id = %s AND user_id = %s", (novel_id, user_id))
        cursor.execute("DELETE FROM novels WHERE id = %s AND user_id = %s", (novel_id, user_id))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()

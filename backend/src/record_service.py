from src.db import get_db


def save_novel(user_id, title, input_type, original_text, total_word_count):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "INSERT INTO novels (user_id, title, input_type, original_text, total_word_count) VALUES (%s, %s, %s, %s, %s)",
            (user_id, title, input_type, original_text, total_word_count)
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def save_chapters(novel_id, user_id, chapters):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        for ch in chapters:
            cursor.execute(
                "INSERT INTO chapters (novel_id, user_id, chapter_index, title, content, word_count) VALUES (%s, %s, %s, %s, %s, %s)",
                (novel_id, user_id, ch['index'], ch['title'], ch['content'], ch['wordCount'])
            )
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def save_parse_record(novel_id, user_id, chapter_count, is_success, message):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "INSERT INTO chapter_parse_records (novel_id, user_id, chapter_count, is_success, message) VALUES (%s, %s, %s, %s, %s)",
            (novel_id, user_id, chapter_count, is_success, message)
        )
        db.commit()
        return cursor.lastrowid
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def update_chapter_title(chapter_id, title):
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "UPDATE chapters SET title = %s WHERE id = %s",
            (title, chapter_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except Exception as e:
        db.rollback()
        raise e
    finally:
        cursor.close()
        db.close()


def get_user_novels_with_records(user_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT n.id, n.title, n.input_type, n.total_word_count,
                   n.created_at, cpr.chapter_count, cpr.is_success, cpr.message
            FROM novels n
            LEFT JOIN (
                SELECT novel_id, chapter_count, is_success, message
                FROM chapter_parse_records
                WHERE id IN (
                    SELECT MAX(id) FROM chapter_parse_records GROUP BY novel_id
                )
            ) cpr ON n.id = cpr.novel_id
            WHERE n.user_id = %s
            ORDER BY n.created_at DESC
        """, (user_id,))
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()
